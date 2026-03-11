import { createHmac, randomUUID } from 'node:crypto'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Subscription } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  BillingCurrency,
  BillingPlanKey,
  findConfiguredPlan,
  getConfiguredBillingPlans,
  isBillingEnabled,
} from './billing.catalog'
import { formatAmountMinor, normalizeStatus, sha256, subscriptionHasAccess } from './billing.utils'
import { PaystackProvider } from './paystack.provider'
import { PolarProvider } from './polar.provider'
import { SearchQuotaService } from './search-quota.service'

type BillingSummaryPlan = {
  planKey: BillingPlanKey
  provider: 'paystack' | 'polar'
  currency: BillingCurrency
  interval: 'weekly' | 'monthly'
  amountMinor: number
  priceLabel: string
  label: string
}

type BillingSnapshot = {
  subscriptionTier: 'free' | 'pro'
  billingStatus: string
  provider: string | null
  interval: string | null
  currency: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly paystack: PaystackProvider,
    private readonly polar: PolarProvider,
    private readonly searchQuota: SearchQuotaService,
  ) {}

  isEnabled() {
    return isBillingEnabled(this.config) && getConfiguredBillingPlans(this.config).length > 0
  }

  async getBillingSnapshot(userId: string): Promise<BillingSnapshot> {
    const subscription = await this.searchQuota.getCurrentSubscription(userId)
    if (!subscription || !subscriptionHasAccess(subscription)) {
      return {
        subscriptionTier: 'free',
        billingStatus: normalizeStatus(subscription?.status) || 'inactive',
        provider: subscription?.provider || null,
        interval: subscription?.interval || null,
        currency: subscription?.currency || null,
        currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() || null,
        cancelAtPeriodEnd: Boolean(subscription?.cancelAtPeriodEnd),
      }
    }

    return {
      subscriptionTier: 'pro',
      billingStatus: normalizeStatus(subscription.status) || 'active',
      provider: subscription.provider,
      interval: subscription.interval,
      currency: subscription.currency,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
      cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    }
  }

  async getBillingSummary(userId: string) {
    const [subscription, quota] = await Promise.all([
      this.searchQuota.getCurrentSubscription(userId),
      this.searchQuota.getQuotaSnapshot(userId),
    ])

    const availablePlans: BillingSummaryPlan[] = getConfiguredBillingPlans(this.config).map((plan) => ({
      planKey: plan.planKey,
      provider: plan.provider,
      currency: plan.currency,
      interval: plan.interval,
      amountMinor: plan.amountMinor,
      priceLabel: plan.priceLabel,
      label: plan.label,
    }))

    return {
      enabled: this.isEnabled(),
      currentSubscription: subscription
        ? {
            id: subscription.id,
            subscriptionTier: subscriptionHasAccess(subscription) ? 'pro' : 'free',
            billingStatus: normalizeStatus(subscription.status) || 'inactive',
            provider: subscription.provider,
            interval: subscription.interval,
            currency: subscription.currency,
            amountMinor: subscription.amountMinor,
            amountLabel: formatAmountMinor(subscription.amountMinor, (subscription.currency || 'USD') as BillingCurrency),
            currentPeriodStart: subscription.currentPeriodStart?.toISOString() || null,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
            cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
            metadata: subscription.metadata || null,
          }
        : null,
      searchQuota: quota,
      availablePlans,
    }
  }

  async createCheckoutSession(userId: string, email: string, input: { planKey: BillingPlanKey; currency: BillingCurrency }) {
    if (!this.isEnabled()) {
      throw new BadRequestException('Billing is not enabled in this environment')
    }

    const plan = findConfiguredPlan(this.config, input.planKey, input.currency)
    if (!plan) {
      throw new BadRequestException('Selected billing plan is not configured')
    }

    if (plan.provider === 'paystack') {
      const reference = `tw_${randomUUID()}`
      const callbackUrl = `${this.getApiBaseUrl()}/api/billing/paystack/callback`
      const checkout = await this.paystack.initializeSubscriptionCheckout({
        email,
        amountMinor: plan.amountMinor,
        planCode: plan.providerRef,
        reference,
        callbackUrl,
        metadata: {
          userId,
          planKey: plan.planKey,
          currency: plan.currency,
          provider: plan.provider,
        },
      })

      await this.prisma.billingCheckout.create({
        data: {
          id: randomUUID(),
          userId,
          provider: 'paystack',
          planKey: plan.planKey,
          tier: 'pro',
          interval: plan.interval,
          currency: plan.currency,
          amountMinor: plan.amountMinor,
          providerReference: checkout.reference,
          status: 'pending',
          redirectUrl: checkout.authorization_url,
          metadata: {
            accessCode: checkout.access_code,
            reference: checkout.reference,
          },
        },
      })

      return { url: checkout.authorization_url }
    }

    const successUrl = `${this.getAppBaseUrl()}/profile?billing=success&provider=polar`
    const returnUrl = `${this.getAppBaseUrl()}/profile?billing=cancelled&provider=polar`
    const checkout = await this.polar.createCheckout({
      productId: plan.providerRef,
      externalCustomerId: userId,
      customerEmail: email,
      successUrl,
      returnUrl,
      metadata: {
        userId,
        planKey: plan.planKey,
        currency: plan.currency,
      },
    })

    await this.prisma.billingCheckout.create({
      data: {
        id: randomUUID(),
        userId,
        provider: 'polar',
        planKey: plan.planKey,
        tier: 'pro',
        interval: plan.interval,
        currency: plan.currency,
        amountMinor: plan.amountMinor,
        providerCheckoutId: checkout.id,
        status: 'pending',
        redirectUrl: checkout.url,
        metadata: {
          polarCustomerId: checkout.customer?.id || null,
        },
      },
    })

    return { url: checkout.url }
  }

  async getCustomerPortalUrl(userId: string) {
    const subscription = await this.requireSubscription(userId)
    if (subscription.provider !== 'polar') {
      throw new BadRequestException('Customer portal is available only for Polar subscriptions')
    }

    const portal = await this.polar.createCustomerPortal(userId)
    return { url: portal.customer_portal_url }
  }

  async cancelSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.requireOwnedSubscription(userId, subscriptionId)
    if (subscription.provider !== 'paystack') {
      throw new BadRequestException('This subscription must be managed in the provider portal')
    }

    const token = String((subscription.metadata as any)?.emailToken || '').trim()
    const code = String(subscription.providerSubscriptionId || '').trim()
    if (!token || !code) {
      throw new BadRequestException('This Paystack subscription is missing management tokens')
    }

    await this.paystack.disableSubscription(code, token)
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'not_renewing',
        cancelAtPeriodEnd: true,
      },
    })

    return { ok: true }
  }

  async resumeSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.requireOwnedSubscription(userId, subscriptionId)
    if (subscription.provider !== 'paystack') {
      throw new BadRequestException('This subscription must be managed in the provider portal')
    }

    const token = String((subscription.metadata as any)?.emailToken || '').trim()
    const code = String(subscription.providerSubscriptionId || '').trim()
    if (!token || !code) {
      throw new BadRequestException('This Paystack subscription is missing management tokens')
    }

    await this.paystack.enableSubscription(code, token)
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'active',
        cancelAtPeriodEnd: false,
      },
    })

    return { ok: true }
  }

  async handlePaystackCallback(reference: string) {
    if (!reference) {
      return `${this.getAppBaseUrl()}/profile?billing=error&provider=paystack`
    }

    try {
      await this.syncPaystackCheckoutReference(reference)
      return `${this.getAppBaseUrl()}/profile?billing=success&provider=paystack`
    } catch {
      return `${this.getAppBaseUrl()}/profile?billing=error&provider=paystack`
    }
  }

  async handlePaystackWebhook(rawBody: Buffer, signature: string | undefined, payload: Record<string, any>) {
    if (!this.paystack.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature')
    }

    const eventType = String(payload.event || '').trim()
    const reference = String(payload?.data?.reference || payload?.data?.subscription_code || '').trim()
    const dedupeKey = sha256(`paystack:${eventType}:${reference}:${JSON.stringify(payload)}`)
    const recorded = await this.recordWebhookEvent('paystack', dedupeKey, eventType, payload, reference)
    if (!recorded) return { ok: true, duplicate: true }

    try {
      if (eventType === 'charge.success' && reference) {
        await this.syncPaystackCheckoutReference(reference)
      } else if (eventType === 'subscription.create' || eventType === 'subscription.created') {
        await this.syncPaystackSubscriptionPayload(payload.data || {})
      } else if (eventType === 'subscription.disable') {
        await this.updatePaystackSubscriptionStatus(String(payload?.data?.subscription_code || ''), 'disabled', true)
      } else if (eventType === 'subscription.not_renewing') {
        await this.updatePaystackSubscriptionStatus(String(payload?.data?.subscription_code || ''), 'not_renewing', true)
      }

      await this.markWebhookProcessed(dedupeKey)
      return { ok: true }
    } catch (error: any) {
      await this.markWebhookFailed(dedupeKey, error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  async handlePolarWebhook(rawBody: Buffer, headers: Record<string, any>) {
    const event = this.polar.validateWebhookEvent(rawBody, headers)
    const eventType = String(event.type || '').trim()
    const data = (event.data || {}) as Record<string, any>
    const dedupeKey = sha256(`polar:${eventType}:${String(data.id || data.subscription?.id || '')}:${JSON.stringify(event)}`)
    const recorded = await this.recordWebhookEvent('polar', dedupeKey, eventType, event, String(data.id || data.subscription?.id || ''))
    if (!recorded) return { ok: true, duplicate: true }

    try {
      if (eventType.startsWith('subscription.')) {
        await this.syncPolarSubscriptionPayload(data)
      }
      if (eventType === 'order.created' && String(data.billing_reason || '').trim().toLowerCase() === 'subscription_cycle' && data.subscription) {
        await this.syncPolarSubscriptionPayload(data.subscription)
      }

      await this.markWebhookProcessed(dedupeKey)
      return { ok: true }
    } catch (error: any) {
      await this.markWebhookFailed(dedupeKey, error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  private async syncPaystackCheckoutReference(reference: string) {
    const verified = await this.paystack.verifyTransaction(reference)
    const status = normalizeStatus(verified.status)

    const checkout = await this.prisma.billingCheckout.findFirst({
      where: {
        provider: 'paystack',
        providerReference: reference,
      },
    })

    if (!checkout) {
      return
    }

    await this.prisma.billingCheckout.update({
      where: { id: checkout.id },
      data: {
        status: status === 'success' ? 'completed' : status || 'pending',
        completedAt: status === 'success' ? new Date() : null,
        metadata: {
          ...(checkout.metadata as Record<string, any> | null),
          verified,
        },
      },
    })

    if (status !== 'success') return

    const providerCustomerId = String(verified.customer?.customer_code || '').trim()
    if (providerCustomerId) {
      await this.upsertBillingCustomer(checkout.userId, 'paystack', providerCustomerId, String(verified.customer?.email || ''))
    }

    const customerId = verified.customer?.id
    if (!customerId) return
    const subscriptions = await this.paystack.listSubscriptionsByCustomer(customerId)
    const selected = subscriptions
      .filter((item) => String(item.plan?.plan_code || '').trim())
      .sort((a, b) => new Date(String(b.next_payment_date || 0)).getTime() - new Date(String(a.next_payment_date || 0)).getTime())[0]

    if (selected) {
      await this.syncPaystackSubscriptionPayload(selected, checkout.userId)
    }
  }

  private async syncPaystackSubscriptionPayload(payload: Record<string, any>, userIdFromCheckout?: string) {
    const providerSubscriptionId = String(payload.subscription_code || '').trim()
    if (!providerSubscriptionId) return

    const providerCustomerId = String(payload?.customer?.customer_code || '').trim()
    const customerEmail = String(payload?.customer?.email || '').trim()
    const metadataUserId = String(payload?.metadata?.userId || '').trim()

    const owner = await this.resolveUserId({
      metadataUserId,
      explicitUserId: userIdFromCheckout,
      provider: 'paystack',
      providerCustomerId,
      email: customerEmail,
    })

    if (!owner) return

    let billingCustomerId: string | null = null
    if (providerCustomerId) {
      const billingCustomer = await this.upsertBillingCustomer(owner, 'paystack', providerCustomerId, customerEmail)
      billingCustomerId = billingCustomer.id
    }

    const planCode = String(payload?.plan?.plan_code || '').trim()
    const plan = getConfiguredBillingPlans(this.config).find((item) => item.provider === 'paystack' && item.providerRef === planCode)
    const interval = String(plan?.interval || payload?.plan?.interval || 'monthly').trim().toLowerCase()
    const amountMinor = Number(plan?.amountMinor || payload?.amount || payload?.plan?.amount || 0)
    const nextPaymentDate = String(payload?.next_payment_date || '').trim()
    const status = normalizeStatus(payload.status) || 'active'

    await this.prisma.subscription.upsert({
      where: {
        provider_providerSubscriptionId: {
          provider: 'paystack',
          providerSubscriptionId,
        },
      },
      update: {
        userId: owner,
        billingCustomerId,
        tier: 'pro',
        interval,
        currency: 'NGN',
        amountMinor,
        providerPlanRef: planCode || null,
        status,
        currentPeriodEnd: nextPaymentDate ? new Date(nextPaymentDate) : null,
        cancelAtPeriodEnd: status === 'not_renewing' || status === 'disabled',
        metadata: {
          ...(payload || {}),
          emailToken: String(payload?.email_token || ''),
        },
      },
      create: {
        id: randomUUID(),
        userId: owner,
        billingCustomerId,
        provider: 'paystack',
        tier: 'pro',
        interval,
        currency: 'NGN',
        amountMinor,
        providerSubscriptionId,
        providerPlanRef: planCode || null,
        status,
        currentPeriodEnd: nextPaymentDate ? new Date(nextPaymentDate) : null,
        cancelAtPeriodEnd: status === 'not_renewing' || status === 'disabled',
        metadata: {
          ...(payload || {}),
          emailToken: String(payload?.email_token || ''),
        },
      },
    })
  }

  private async syncPolarSubscriptionPayload(payload: Record<string, any>) {
    const providerSubscriptionId = String(payload?.id || '').trim()
    if (!providerSubscriptionId) return

    const externalCustomerId = String(payload?.customer?.external_id || payload?.customer_external_id || '').trim()
    const customerId = String(payload?.customer?.id || '').trim()
    const customerEmail = String(payload?.customer?.email || '').trim()
    const owner = await this.resolveUserId({
      metadataUserId: externalCustomerId,
      provider: 'polar',
      providerCustomerId: customerId,
      email: customerEmail,
    })

    if (!owner) return

    let billingCustomerId: string | null = null
    if (customerId) {
      const billingCustomer = await this.upsertBillingCustomer(owner, 'polar', customerId, customerEmail || 'unknown@example.com')
      billingCustomerId = billingCustomer.id
    }

    const productId = String(payload?.product?.id || payload?.product_id || '').trim()
    const plan = getConfiguredBillingPlans(this.config).find((item) => item.provider === 'polar' && item.providerRef === productId)
    const interval = String(plan?.interval || payload?.recurring_interval || payload?.interval || 'monthly').trim().toLowerCase()
    const currency = String(plan?.currency || payload?.currency || 'USD').trim().toUpperCase()
    const amountMinor = Number(plan?.amountMinor || payload?.amount || 0)
    const currentPeriodStart = String(payload?.current_period_start || payload?.started_at || '').trim()
    const currentPeriodEnd = String(payload?.current_period_end || payload?.ends_at || '').trim()
    const status = normalizeStatus(payload?.status) || 'active'

    await this.prisma.subscription.upsert({
      where: {
        provider_providerSubscriptionId: {
          provider: 'polar',
          providerSubscriptionId,
        },
      },
      update: {
        userId: owner,
        billingCustomerId,
        tier: 'pro',
        interval,
        currency,
        amountMinor,
        providerProductRef: productId || null,
        status,
        currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
        cancelAtPeriodEnd: status === 'canceled' || status === 'revoked',
        metadata: payload,
      },
      create: {
        id: randomUUID(),
        userId: owner,
        billingCustomerId,
        provider: 'polar',
        tier: 'pro',
        interval,
        currency,
        amountMinor,
        providerSubscriptionId,
        providerProductRef: productId || null,
        status,
        currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
        cancelAtPeriodEnd: status === 'canceled' || status === 'revoked',
        metadata: payload,
      },
    })
  }

  private async updatePaystackSubscriptionStatus(providerSubscriptionId: string, status: string, cancelAtPeriodEnd: boolean) {
    if (!providerSubscriptionId) return
    await this.prisma.subscription.updateMany({
      where: {
        provider: 'paystack',
        providerSubscriptionId,
      },
      data: {
        status,
        cancelAtPeriodEnd,
      },
    })
  }

  private async upsertBillingCustomer(userId: string, provider: 'paystack' | 'polar', providerCustomerId: string, email: string) {
    return await this.prisma.billingCustomer.upsert({
      where: {
        provider_providerCustomerId: {
          provider,
          providerCustomerId,
        },
      },
      update: {
        userId,
        email: email || 'unknown@example.com',
      },
      create: {
        id: randomUUID(),
        userId,
        provider,
        providerCustomerId,
        email: email || 'unknown@example.com',
      },
    })
  }

  private async resolveUserId(params: {
    metadataUserId?: string
    explicitUserId?: string
    provider: 'paystack' | 'polar'
    providerCustomerId?: string
    email?: string
  }) {
    if (params.metadataUserId) return params.metadataUserId
    if (params.explicitUserId) return params.explicitUserId

    if (params.providerCustomerId) {
      const billingCustomer = await this.prisma.billingCustomer.findUnique({
        where: {
          provider_providerCustomerId: {
            provider: params.provider,
            providerCustomerId: params.providerCustomerId,
          },
        },
      })
      if (billingCustomer?.userId) return billingCustomer.userId
    }

    if (params.email) {
      const user = await this.prisma.user.findUnique({
        where: { email: params.email.toLowerCase() },
        select: { id: true },
      })
      if (user?.id) return user.id
    }

    return null
  }

  private async requireSubscription(userId: string) {
    const subscription = await this.searchQuota.getCurrentSubscription(userId)
    if (!subscription) {
      throw new NotFoundException('No subscription found for this account')
    }
    return subscription
  }

  private async requireOwnedSubscription(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId,
      },
    })
    if (!subscription) {
      throw new NotFoundException('Subscription not found')
    }
    return subscription
  }

  private async recordWebhookEvent(
    provider: 'paystack' | 'polar',
    dedupeKey: string,
    eventType: string,
    payload: Record<string, any>,
    externalEventId?: string,
  ) {
    try {
      await this.prisma.billingWebhookEvent.create({
        data: {
          id: randomUUID(),
          provider,
          externalEventId: externalEventId || null,
          dedupeKey,
          eventType: eventType || null,
          payload,
        },
      })
      return true
    } catch {
      return false
    }
  }

  private async markWebhookProcessed(dedupeKey: string) {
    await this.prisma.billingWebhookEvent.update({
      where: { dedupeKey },
      data: {
        status: 'processed',
        processedAt: new Date(),
      },
    })
  }

  private async markWebhookFailed(dedupeKey: string, message: string) {
    await this.prisma.billingWebhookEvent.update({
      where: { dedupeKey },
      data: {
        status: 'failed',
        errorMessage: message.slice(0, 1000),
      },
    })
  }

  private getAppBaseUrl() {
    const url = String(this.config.get<string>('BILLING_APP_BASE_URL') || '').trim()
    if (!url) {
      throw new InternalServerErrorException('BILLING_APP_BASE_URL is not configured')
    }
    return url.replace(/\/$/, '')
  }

  private getApiBaseUrl() {
    const url = String(this.config.get<string>('BILLING_API_BASE_URL') || '').trim()
    if (!url) {
      throw new InternalServerErrorException('BILLING_API_BASE_URL is not configured')
    }
    return url.replace(/\/$/, '')
  }
}
