import { createHash } from 'node:crypto'
import type { Subscription } from '@prisma/client'
import type { BillingCurrency } from './billing.catalog'

export function startOfUtcDay(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

export function nextUtcResetAt(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + 1))
}

export function normalizeStatus(status: string | null | undefined) {
  return String(status || '').trim().toLowerCase()
}

export function subscriptionHasAccess(
  subscription:
    | Pick<Subscription, 'status' | 'currentPeriodEnd' | 'cancelAtPeriodEnd'>
    | null
    | undefined,
  now = new Date(),
) {
  if (!subscription) return false

  const status = normalizeStatus(subscription.status)
  if (status === 'active' || status === 'trialing' || status === 'paid') return true

  if (
    (status === 'cancelled' || status === 'canceled' || status === 'not_renewing' || status === 'disabled') &&
    subscription.cancelAtPeriodEnd &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd.getTime() > now.getTime()
  ) {
    return true
  }

  return false
}

export function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

export function formatAmountMinor(amountMinor: number, currency: BillingCurrency) {
  return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
    style: 'currency',
    currency,
  }).format((Number(amountMinor) || 0) / 100)
}
