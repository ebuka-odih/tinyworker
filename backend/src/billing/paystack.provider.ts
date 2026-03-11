import { createHmac } from 'node:crypto'
import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

type PaystackInitializeCheckoutInput = {
  email: string
  amountMinor: number
  planCode: string
  reference: string
  callbackUrl: string
  metadata: Record<string, any>
}

type PaystackSubscriptionRecord = {
  subscription_code?: string
  status?: string
  amount?: number
  email_token?: string
  next_payment_date?: string
  customer?: {
    id?: number
    customer_code?: string
    email?: string
  }
  plan?: {
    name?: string
    interval?: string
    amount?: number
    plan_code?: string
  }
  authorization?: {
    authorization_code?: string
  }
}

@Injectable()
export class PaystackProvider {
  constructor(private readonly config: ConfigService) {}

  private get secretKey() {
    const value = String(this.config.get<string>('PAYSTACK_SECRET_KEY') || '').trim()
    if (!value) {
      throw new ServiceUnavailableException('Paystack is not configured')
    }
    return value
  }

  private get baseUrl() {
    return 'https://api.paystack.co'
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })

    const raw = await response.text().catch(() => '')
    const payload = raw ? JSON.parse(raw) : {}
    if (!response.ok || payload?.status === false) {
      throw new Error(payload?.message || `Paystack request failed (${response.status})`)
    }

    return payload.data as T
  }

  async initializeSubscriptionCheckout(input: PaystackInitializeCheckoutInput) {
    return await this.request<{
      authorization_url: string
      access_code: string
      reference: string
    }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amountMinor,
        plan: input.planCode,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    })
  }

  async verifyTransaction(reference: string) {
    return await this.request<{
      id?: number
      status?: string
      reference?: string
      amount?: number
      currency?: string
      paid_at?: string
      customer?: {
        id?: number
        email?: string
        customer_code?: string
      }
      authorization?: {
        authorization_code?: string
      }
      plan?: {
        name?: string
        interval?: string
        amount?: number
        plan_code?: string
      }
      metadata?: Record<string, any>
    }>(`/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    })
  }

  async listSubscriptionsByCustomer(customerId: number | string) {
    const query = new URLSearchParams()
    query.set('customer', String(customerId))
    const result = await this.request<PaystackSubscriptionRecord[]>(`/subscription?${query.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    })
    return Array.isArray(result) ? result : []
  }

  async disableSubscription(code: string, token: string) {
    return await this.request<{ message?: string }>('/subscription/disable', {
      method: 'POST',
      body: JSON.stringify({ code, token }),
    })
  }

  async enableSubscription(code: string, token: string) {
    return await this.request<{ message?: string }>('/subscription/enable', {
      method: 'POST',
      body: JSON.stringify({ code, token }),
    })
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex')
    return Boolean(signature) && expected === signature
  }
}
