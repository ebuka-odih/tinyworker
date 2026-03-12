import React from 'react';
import {
  Bell,
  Bookmark,
  CheckCircle2,
  Crown,
  ExternalLink,
  Loader2,
  LogOut,
  RotateCcw,
  Shield,
  User,
  Wallet,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { BillingCurrency, BillingPlan, BillingSummary, SavedOpportunity, SearchRunSummary } from '../types';
import { ApiUnauthorizedError } from '../services/apiBase';
import {
  cancelSubscription,
  createBillingCheckoutSession,
  getBillingSummary,
  getCustomerPortalUrl,
  resumeSubscription,
} from '../services/billingApi';
import { listSavedOpportunities } from '../services/opportunitiesApi';

const EMPTY_SEARCH_RUN_SUMMARY: SearchRunSummary = {
  totalSearchesRun: 0,
  jobsRun: 0,
  scholarshipsRun: 0,
  grantsRun: 0,
  visasRun: 0,
};

const EMPTY_BILLING_SUMMARY: BillingSummary = {
  enabled: false,
  currentSubscription: null,
  searchQuota: {
    dailyLimit: null,
    usedToday: 0,
    remainingToday: null,
    resetAt: '',
    unlimited: false,
  },
  availablePlans: [],
};

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
}

function toTitleCase(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return 'Inactive';
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function usageProgress(summary: BillingSummary | null) {
  if (!summary || summary.searchQuota.unlimited || !summary.searchQuota.dailyLimit) return 100;
  const percent = (summary.searchQuota.usedToday / summary.searchQuota.dailyLimit) * 100;
  return Math.max(0, Math.min(100, percent));
}

function planSortValue(plan: BillingPlan) {
  return plan.interval === 'weekly' ? 0 : 1;
}

function isMissingBillingRoute(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /\b404\b/.test(message) || /cannot\s+(get|post)\s+\/api\/billing/i.test(message);
}

export function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, authUser, refreshAuthUser, signOut } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'saved' | 'billing' | 'settings'>('saved');
  const [savedOpportunities, setSavedOpportunities] = React.useState<SavedOpportunity[]>([]);
  const [savedLoading, setSavedLoading] = React.useState(true);
  const [billingSummary, setBillingSummary] = React.useState<BillingSummary | null>(null);
  const [billingLoading, setBillingLoading] = React.useState(true);
  const [billingBusyKey, setBillingBusyKey] = React.useState<string | null>(null);
  const [billingError, setBillingError] = React.useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = React.useState<BillingCurrency>('NGN');

  const initials = React.useMemo(() => authUser?.email?.slice(0, 2).toUpperCase() || 'TW', [authUser?.email]);
  const searchRunSummary = React.useMemo(
    () => authUser?.searchRunSummary ?? EMPTY_SEARCH_RUN_SUMMARY,
    [authUser?.searchRunSummary],
  );
  const activityCards = React.useMemo(
    () => [
      { label: 'Total runs', value: searchRunSummary.totalSearchesRun },
      { label: 'Jobs', value: searchRunSummary.jobsRun },
      { label: 'Scholarships', value: searchRunSummary.scholarshipsRun },
      { label: 'Grants', value: searchRunSummary.grantsRun },
      { label: 'Visas', value: searchRunSummary.visasRun },
    ],
    [searchRunSummary],
  );
  const bannerState = React.useMemo(() => new URLSearchParams(location.search).get('billing'), [location.search]);
  const handleSignOut = React.useCallback(() => {
    signOut();
    navigate('/auth?next=%2Fnew-search', { replace: true });
  }, [navigate, signOut]);

  React.useEffect(() => {
    if (bannerState) {
      setActiveTab('billing');
    }
  }, [bannerState]);

  const loadBilling = React.useCallback(async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const summary = await getBillingSummary(accessToken);
      setBillingSummary(summary);
      if (summary.availablePlans.some((plan) => plan.currency === 'USD') && authUser?.billingCurrency === 'USD') {
        setSelectedCurrency('USD');
      } else if (summary.availablePlans.some((plan) => plan.currency === 'NGN')) {
        setSelectedCurrency('NGN');
      } else if (summary.availablePlans[0]?.currency) {
        setSelectedCurrency(summary.availablePlans[0].currency);
      }
    } catch (error) {
      if (error instanceof ApiUnauthorizedError) {
        handleSignOut();
        return;
      }
      if (isMissingBillingRoute(error)) {
        setBillingSummary({
          ...EMPTY_BILLING_SUMMARY,
          searchQuota: authUser?.searchQuota || EMPTY_BILLING_SUMMARY.searchQuota,
        });
        setBillingError(null);
        return;
      }
      setBillingSummary(null);
      setBillingError(error instanceof Error ? error.message : 'Could not load billing right now.');
    } finally {
      setBillingLoading(false);
    }
  }, [accessToken, authUser?.billingCurrency, authUser?.searchQuota, handleSignOut]);

  React.useEffect(() => {
    if (!accessToken) return;
    void refreshAuthUser();
  }, [accessToken, refreshAuthUser]);

  React.useEffect(() => {
    if (!accessToken || activeTab !== 'saved') return;
    let cancelled = false;

    const loadSavedOpportunities = async () => {
      setSavedLoading(true);
      try {
        const opportunities = await listSavedOpportunities(accessToken, 'job');
        if (cancelled) return;
        setSavedOpportunities(opportunities);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiUnauthorizedError) {
          handleSignOut();
          return;
        }
        setSavedOpportunities([]);
      } finally {
        if (!cancelled) {
          setSavedLoading(false);
        }
      }
    };

    void loadSavedOpportunities();

    return () => {
      cancelled = true;
    };
  }, [accessToken, activeTab, handleSignOut]);

  React.useEffect(() => {
    if (!accessToken || (activeTab !== 'billing' && !bannerState)) return;
    void loadBilling();
  }, [accessToken, activeTab, bannerState, loadBilling]);

  const filteredPlans = React.useMemo(
    () =>
      (billingSummary?.availablePlans || [])
        .filter((plan) => plan.currency === selectedCurrency)
        .sort((a, b) => planSortValue(a) - planSortValue(b)),
    [billingSummary?.availablePlans, selectedCurrency],
  );

  const handleCheckout = React.useCallback(
    async (plan: BillingPlan) => {
      setBillingBusyKey(`${plan.planKey}:${plan.currency}`);
      setBillingError(null);
      try {
        const checkout = await createBillingCheckoutSession({
          token: accessToken,
          planKey: plan.planKey,
          currency: plan.currency,
        });
        window.location.href = checkout.url;
      } catch (error) {
        if (error instanceof ApiUnauthorizedError) {
          handleSignOut();
          return;
        }
        setBillingError(error instanceof Error ? error.message : 'Could not start checkout right now.');
      } finally {
        setBillingBusyKey(null);
      }
    },
    [accessToken, handleSignOut],
  );

  const handlePortal = React.useCallback(async () => {
    setBillingBusyKey('portal');
    setBillingError(null);
    try {
      const portal = await getCustomerPortalUrl(accessToken);
      window.location.href = portal.url;
    } catch (error) {
      if (error instanceof ApiUnauthorizedError) {
        handleSignOut();
        return;
      }
      setBillingError(error instanceof Error ? error.message : 'Could not open the billing portal.');
    } finally {
      setBillingBusyKey(null);
    }
  }, [accessToken, handleSignOut]);

  const handleCancelSubscription = React.useCallback(async () => {
    const subscriptionId = billingSummary?.currentSubscription?.id;
    if (!subscriptionId) return;
    setBillingBusyKey('cancel');
    setBillingError(null);
    try {
      await cancelSubscription(accessToken, subscriptionId);
      await Promise.all([loadBilling(), refreshAuthUser()]);
    } catch (error) {
      if (error instanceof ApiUnauthorizedError) {
        handleSignOut();
        return;
      }
      setBillingError(error instanceof Error ? error.message : 'Could not cancel this subscription.');
    } finally {
      setBillingBusyKey(null);
    }
  }, [accessToken, billingSummary?.currentSubscription?.id, handleSignOut, loadBilling, refreshAuthUser]);

  const handleResumeSubscription = React.useCallback(async () => {
    const subscriptionId = billingSummary?.currentSubscription?.id;
    if (!subscriptionId) return;
    setBillingBusyKey('resume');
    setBillingError(null);
    try {
      await resumeSubscription(accessToken, subscriptionId);
      await Promise.all([loadBilling(), refreshAuthUser()]);
    } catch (error) {
      if (error instanceof ApiUnauthorizedError) {
        handleSignOut();
        return;
      }
      setBillingError(error instanceof Error ? error.message : 'Could not resume this subscription.');
    } finally {
      setBillingBusyKey(null);
    }
  }, [accessToken, billingSummary?.currentSubscription?.id, handleSignOut, loadBilling, refreshAuthUser]);

  const currentSubscription = billingSummary?.currentSubscription || null;
  const quota = billingSummary?.searchQuota || authUser?.searchQuota;

  return (
    <div className="max-w-4xl mx-auto py-4 md:py-8">
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        <div className="w-full md:w-64 flex flex-col gap-2">
          <div className="p-6 bg-white rounded-2xl border border-neutral-200 shadow-sm mb-2 md:mb-6 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-900 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              {initials}
            </div>
            <h2 className="text-xl font-bold">Account</h2>
            <p className="text-sm text-neutral-500 truncate">{authUser?.email || 'Signed-in user'}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-600">
              {authUser?.subscriptionTier === 'pro' ? <Crown size={13} /> : <Shield size={13} />}
              {authUser?.subscriptionTier === 'pro' ? 'Pro access' : 'Free plan'}
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
            {[
              { id: 'saved' as const, label: 'Saved', icon: Bookmark },
              { id: 'billing' as const, label: 'Billing', icon: Wallet },
              { id: 'settings' as const, label: 'Settings', icon: Shield },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-xl font-bold transition-all min-h-[48px] ${
                  activeTab === tab.id
                    ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200'
                    : 'text-neutral-500 hover:bg-neutral-100 border border-neutral-100 md:border-transparent'
                }`}
              >
                <tab.icon size={20} />
                <span className="text-sm md:text-base">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="pt-4 border-t border-neutral-200 mt-4 hidden md:block">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all min-h-[48px]"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>

        <div className="flex-1 w-full space-y-6">
          {bannerState && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                bannerState === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : bannerState === 'cancelled'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {bannerState === 'success'
                ? 'Billing was updated successfully. Refreshing plan data may take a few seconds after provider confirmation.'
                : bannerState === 'cancelled'
                ? 'Checkout was cancelled before payment completed.'
                : 'Billing verification did not complete successfully. You can retry from this page.'}
            </div>
          )}

          <section className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Search activity</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-500 max-w-2xl">
                  Counts come from persisted backend search runs. Opening pages, clicking cards, editing drafts, and
                  saving recent searches do not affect these totals.
                </p>
              </div>
              <span className="text-sm font-medium text-neutral-400">{searchRunSummary.totalSearchesRun} total</span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {activityCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">{card.label}</p>
                  <p className="mt-3 text-3xl font-bold text-neutral-900">{card.value}</p>
                </div>
              ))}
            </div>
          </section>

          {activeTab === 'saved' ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">Saved Opportunities</h3>
                <span className="text-sm font-medium text-neutral-400">{savedOpportunities.length} saved</span>
              </div>

              {savedLoading ? (
                <div className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-sm flex items-center gap-3 text-neutral-500">
                  <Loader2 size={20} className="animate-spin" />
                  Loading saved opportunities...
                </div>
              ) : savedOpportunities.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-5">
                    <Bookmark size={24} />
                  </div>
                  <h4 className="text-xl font-bold text-neutral-900">No saved opportunities yet</h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-500 max-w-xl">
                    Save jobs from the search session with the bookmark icon and they will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedOpportunities.map((opportunity) => (
                    <div key={opportunity.id} className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-lg font-bold text-neutral-900">{opportunity.title}</h4>
                          <p className="mt-1 text-sm text-neutral-500">
                            {opportunity.organization || 'Unknown organization'} • {opportunity.location || 'Unknown location'}
                          </p>
                          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                            {opportunity.source || 'Saved from search'}
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-bold uppercase tracking-wider">
                          Saved
                        </span>
                      </div>

                      {opportunity.description && (
                        <p className="mt-4 text-sm leading-6 text-neutral-600">{opportunity.description}</p>
                      )}

                      <div className="mt-5 flex items-center justify-end">
                        {opportunity.link ? (
                          <a
                            href={opportunity.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-black transition-all"
                          >
                            Open listing
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="inline-flex items-center rounded-xl bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-500">
                            Source link unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : activeTab === 'billing' ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">Billing & Search Access</h3>
                  <p className="mt-1 text-sm text-neutral-500">Manage plan access, daily search allowance, and checkout provider.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadBilling()}
                  disabled={billingLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-neutral-700 transition-all hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-60"
                >
                  <RotateCcw size={14} className={billingLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>

              {billingError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {billingError}
                </div>
              )}

              {billingLoading ? (
                <div className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-sm flex items-center gap-3 text-neutral-500">
                  <Loader2 size={20} className="animate-spin" />
                  Loading billing summary...
                </div>
              ) : !billingSummary?.enabled ? (
                <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                  <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-600">
                    <Shield size={14} />
                    Billing unavailable
                  </div>
                  <h4 className="mt-4 text-xl font-bold text-neutral-900">Billing is not enabled in this environment.</h4>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                    Search access is still available, but checkout, quota enforcement, and self-serve subscription management are not configured here.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <section className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-600">
                          {currentSubscription ? <Crown size={14} /> : <Shield size={14} />}
                          {currentSubscription ? 'Current subscription' : 'Free access'}
                        </div>
                        <div>
                          <h4 className="text-2xl font-bold text-neutral-900">
                            {currentSubscription
                              ? `${toTitleCase(currentSubscription.provider)} ${toTitleCase(currentSubscription.interval)}`
                              : 'Starter access'}
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-neutral-500">
                            {currentSubscription
                              ? `${currentSubscription.amountLabel} • ${toTitleCase(currentSubscription.billingStatus)}`
                              : 'Free accounts can start up to 2 live searches per UTC day until you upgrade.'}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Status</p>
                          <p className="mt-2 text-sm font-semibold text-neutral-900">
                            {toTitleCase(currentSubscription?.billingStatus || authUser?.billingStatus)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Renews / ends</p>
                          <p className="mt-2 text-sm font-semibold text-neutral-900">
                            {formatDateTime(currentSubscription?.currentPeriodEnd || authUser?.billingCurrentPeriodEnd)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Quota today</p>
                        <p className="mt-2 text-2xl font-bold text-neutral-900">
                          {quota?.unlimited ? 'Unlimited' : `${quota?.usedToday || 0}/${quota?.dailyLimit || 0}`}
                        </p>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className={`h-full rounded-full transition-all ${quota?.unlimited ? 'bg-emerald-500' : 'bg-neutral-900'}`}
                            style={{ width: `${usageProgress(billingSummary)}%` }}
                          />
                        </div>
                        <p className="mt-3 text-sm text-neutral-500">
                          {quota?.unlimited
                            ? 'Paid access removes the daily cap while the subscription stays active.'
                            : `${quota?.remainingToday || 0} live search${quota?.remainingToday === 1 ? '' : 'es'} remaining before reset.`}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Reset window</p>
                        <p className="mt-2 text-2xl font-bold text-neutral-900">{formatDateTime(quota?.resetAt)}</p>
                        <p className="mt-3 text-sm text-neutral-500">
                          The free search allowance resets on a UTC daily boundary. Billing access updates after provider confirmation.
                        </p>
                      </div>
                    </div>

                    {currentSubscription?.provider === 'polar' ? (
                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handlePortal()}
                          disabled={billingBusyKey === 'portal'}
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-black disabled:opacity-60"
                        >
                          {billingBusyKey === 'portal' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                          Open billing portal
                        </button>
                      </div>
                    ) : currentSubscription?.provider === 'paystack' ? (
                      <div className="mt-6 flex flex-wrap gap-3">
                        {currentSubscription.cancelAtPeriodEnd ? (
                          <button
                            type="button"
                            onClick={() => void handleResumeSubscription()}
                            disabled={billingBusyKey === 'resume'}
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-black disabled:opacity-60"
                          >
                            {billingBusyKey === 'resume' ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            Resume Paystack plan
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleCancelSubscription()}
                            disabled={billingBusyKey === 'cancel'}
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-700 transition-all hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-60"
                          >
                            {billingBusyKey === 'cancel' ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                            Cancel at period end
                          </button>
                        )}
                      </div>
                    ) : null}
                  </section>

                  <section className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="text-lg font-bold text-neutral-900">Upgrade options</h4>
                        <p className="mt-1 text-sm text-neutral-500">
                          Choose the billing currency first. NGN routes through Paystack and USD routes through Polar.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-100 p-1">
                        {(['NGN', 'USD'] as BillingCurrency[]).map((currency) => (
                          <button
                            key={currency}
                            type="button"
                            onClick={() => setSelectedCurrency(currency)}
                            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                              selectedCurrency === currency ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                          >
                            {currency}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-2">
                      {filteredPlans.map((plan) => {
                        const isCurrent =
                          currentSubscription &&
                          currentSubscription.provider === plan.provider &&
                          currentSubscription.interval === plan.interval &&
                          currentSubscription.currency.toUpperCase() === plan.currency;

                        return (
                          <div key={`${plan.planKey}:${plan.currency}`} className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                                  {plan.provider === 'paystack' ? 'Paystack' : 'Polar'} • {plan.currency}
                                </p>
                                <h5 className="mt-3 text-2xl font-bold text-neutral-900">{plan.label}</h5>
                                <p className="mt-2 text-sm text-neutral-500">{toTitleCase(plan.interval)} billing cadence</p>
                              </div>
                              {isCurrent && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-800">
                                  Current
                                </span>
                              )}
                            </div>

                            <div className="mt-6">
                              <p className="text-3xl font-bold text-neutral-900">{plan.priceLabel}</p>
                              <p className="mt-1 text-sm text-neutral-500">
                                Unlimited live searches while this plan is active.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => void handleCheckout(plan)}
                              disabled={Boolean(billingBusyKey) || Boolean(isCurrent)}
                              className={`mt-6 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition-all ${
                                isCurrent
                                  ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                                  : 'bg-neutral-900 text-white hover:bg-black disabled:opacity-60'
                              }`}
                            >
                              {billingBusyKey === `${plan.planKey}:${plan.currency}` ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : isCurrent ? (
                                <CheckCircle2 size={16} />
                              ) : (
                                <Crown size={16} />
                              )}
                              {isCurrent ? 'Already active' : `Upgrade with ${plan.provider === 'paystack' ? 'Paystack' : 'Polar'}`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">Account Settings</h3>
                <span className="text-sm font-medium text-neutral-400">Secure session</span>
              </div>

              <div className="space-y-6">
                <section className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                  <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <User size={16} />
                    Identity
                  </h4>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Email</p>
                      <p className="mt-2 text-sm font-semibold text-neutral-900 break-all">{authUser?.email}</p>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">User ID</p>
                      <p className="mt-2 text-sm font-semibold text-neutral-900 break-all">{authUser?.userId}</p>
                    </div>
                  </div>
                </section>

                <section className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                  <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <Bell size={16} />
                    Notifications
                  </h4>
                  <div className="mt-5 space-y-4 text-sm text-neutral-500">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      Email alerts and digests are not wired yet in this web client.
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      Billing status and search allowance are already account-scoped, so future digests can be added without changing auth.
                    </div>
                  </div>
                </section>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="md:hidden w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl font-bold text-red-500 border border-red-100 hover:bg-red-50 transition-all min-h-[48px]"
                >
                  <LogOut size={20} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
