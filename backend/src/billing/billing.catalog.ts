import { ConfigService } from '@nestjs/config'

export type BillingTier = 'free' | 'pro'
export type BillingInterval = 'weekly' | 'monthly'
export type BillingCurrency = 'NGN' | 'USD'
export type BillingProvider = 'paystack' | 'polar'
export type BillingPlanKey = 'pro_weekly' | 'pro_monthly'

export type BillingPlanCatalogEntry = {
  planKey: BillingPlanKey
  tier: Exclude<BillingTier, 'free'>
  interval: BillingInterval
  currency: BillingCurrency
  provider: BillingProvider
  amountMinor: number
  label: string
  priceLabel: string
  providerRef: string
  configured: boolean
}

function getBoolean(value: string | undefined, fallback = false) {
  if (value === undefined) return fallback
  return /^true$/i.test(String(value).trim())
}

function getAmountMinor(config: ConfigService, key: string, fallback: number) {
  const raw = Number(config.get<string>(key) || fallback)
  if (!Number.isFinite(raw) || raw <= 0) return fallback
  return Math.round(raw)
}

function formatAmount(amountMinor: number, currency: BillingCurrency) {
  return new Intl.NumberFormat(currency === 'NGN' ? 'en-NG' : 'en-US', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100)
}

export function getFreeDailySearchLimit(config: ConfigService) {
  const raw = Number(config.get<string>('FREE_DAILY_SEARCH_LIMIT') || 2)
  if (!Number.isFinite(raw) || raw < 1) return 2
  return Math.floor(raw)
}

export function isBillingEnabled(config: ConfigService) {
  return getBoolean(config.get<string>('BILLING_ENABLED'), false)
}

export function getBillingCatalog(config: ConfigService): BillingPlanCatalogEntry[] {
  const ngnWeeklyAmount = getAmountMinor(config, 'BILLING_PRO_WEEKLY_NGN_AMOUNT_MINOR', 150000)
  const ngnMonthlyAmount = getAmountMinor(config, 'BILLING_PRO_MONTHLY_NGN_AMOUNT_MINOR', 500000)
  const usdWeeklyAmount = getAmountMinor(config, 'BILLING_PRO_WEEKLY_USD_AMOUNT_MINOR', 500)
  const usdMonthlyAmount = getAmountMinor(config, 'BILLING_PRO_MONTHLY_USD_AMOUNT_MINOR', 1500)

  const paystackWeeklyRef = String(config.get<string>('PAYSTACK_PRO_WEEKLY_PLAN_CODE') || '').trim()
  const paystackMonthlyRef = String(config.get<string>('PAYSTACK_PRO_MONTHLY_PLAN_CODE') || '').trim()
  const polarWeeklyRef = String(config.get<string>('POLAR_PRO_WEEKLY_PRODUCT_ID') || '').trim()
  const polarMonthlyRef = String(config.get<string>('POLAR_PRO_MONTHLY_PRODUCT_ID') || '').trim()

  return [
    {
      planKey: 'pro_weekly',
      tier: 'pro',
      interval: 'weekly',
      currency: 'NGN',
      provider: 'paystack',
      amountMinor: ngnWeeklyAmount,
      label: 'Pro Weekly',
      priceLabel: formatAmount(ngnWeeklyAmount, 'NGN'),
      providerRef: paystackWeeklyRef,
      configured: Boolean(paystackWeeklyRef),
    },
    {
      planKey: 'pro_monthly',
      tier: 'pro',
      interval: 'monthly',
      currency: 'NGN',
      provider: 'paystack',
      amountMinor: ngnMonthlyAmount,
      label: 'Pro Monthly',
      priceLabel: formatAmount(ngnMonthlyAmount, 'NGN'),
      providerRef: paystackMonthlyRef,
      configured: Boolean(paystackMonthlyRef),
    },
    {
      planKey: 'pro_weekly',
      tier: 'pro',
      interval: 'weekly',
      currency: 'USD',
      provider: 'polar',
      amountMinor: usdWeeklyAmount,
      label: 'Pro Weekly',
      priceLabel: formatAmount(usdWeeklyAmount, 'USD'),
      providerRef: polarWeeklyRef,
      configured: Boolean(polarWeeklyRef),
    },
    {
      planKey: 'pro_monthly',
      tier: 'pro',
      interval: 'monthly',
      currency: 'USD',
      provider: 'polar',
      amountMinor: usdMonthlyAmount,
      label: 'Pro Monthly',
      priceLabel: formatAmount(usdMonthlyAmount, 'USD'),
      providerRef: polarMonthlyRef,
      configured: Boolean(polarMonthlyRef),
    },
  ]
}

export function getConfiguredBillingPlans(config: ConfigService) {
  if (!isBillingEnabled(config)) return []
  return getBillingCatalog(config).filter((plan) => plan.configured)
}

export function findConfiguredPlan(config: ConfigService, planKey: BillingPlanKey, currency: BillingCurrency) {
  return getConfiguredBillingPlans(config).find((plan) => plan.planKey === planKey && plan.currency === currency) || null
}
