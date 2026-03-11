import { BillingCurrency, BillingPlanKey, BillingSummary } from '../types';
import {
  API_BASE,
  ApiPaymentRequiredError,
  ApiUnauthorizedError,
  buildAuthHeaders,
  readErrorDetails,
  readErrorMessage,
} from './apiBase';

export async function getBillingSummary(token: string): Promise<BillingSummary> {
  const response = await fetch(`${API_BASE}/billing/summary`, {
    headers: buildAuthHeaders(token),
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to load billing summary (${response.status})`));
  }

  return (await response.json()) as BillingSummary;
}

export async function createBillingCheckoutSession(params: {
  token: string;
  planKey: BillingPlanKey;
  currency: BillingCurrency;
}): Promise<{ url: string }> {
  const response = await fetch(`${API_BASE}/billing/checkout-sessions`, {
    method: 'POST',
    headers: buildAuthHeaders(params.token, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      planKey: params.planKey,
      currency: params.currency,
    }),
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (response.status === 402) {
    const details = await readErrorDetails(response, 'Payment required');
    throw new ApiPaymentRequiredError(details.message, details.payload);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to create checkout session (${response.status})`));
  }

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error('Checkout session did not return a redirect URL.');
  }

  return { url: payload.url };
}

export async function getCustomerPortalUrl(token: string): Promise<{ url: string }> {
  const response = await fetch(`${API_BASE}/billing/customer-portal`, {
    headers: buildAuthHeaders(token),
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to open customer portal (${response.status})`));
  }

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error('Customer portal did not return a redirect URL.');
  }

  return { url: payload.url };
}

export async function cancelSubscription(token: string, subscriptionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to cancel subscription (${response.status})`));
  }
}

export async function resumeSubscription(token: string, subscriptionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/billing/subscriptions/${encodeURIComponent(subscriptionId)}/resume`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
  });

  if (response.status === 401) {
    throw new ApiUnauthorizedError();
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Failed to resume subscription (${response.status})`));
  }
}
