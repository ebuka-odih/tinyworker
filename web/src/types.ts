export enum SearchType {
  JOB = 'job',
  SCHOLARSHIP = 'scholarship',
  GRANT = 'grant',
  VISA = 'visa',
}

export interface SearchRunSummary {
  totalSearchesRun: number;
  jobsRun: number;
  scholarshipsRun: number;
  grantsRun: number;
  visasRun: number;
}

export interface SearchQuota {
  dailyLimit: number | null;
  usedToday: number;
  remainingToday: number | null;
  resetAt: string;
  unlimited: boolean;
}

export type BillingProvider = 'paystack' | 'polar';
export type BillingCurrency = 'NGN' | 'USD';
export type BillingPlanKey = 'pro_weekly' | 'pro_monthly';

export interface BillingPlan {
  planKey: BillingPlanKey;
  provider: BillingProvider;
  currency: BillingCurrency;
  interval: 'weekly' | 'monthly';
  amountMinor: number;
  priceLabel: string;
  label: string;
}

export interface BillingCurrentSubscription {
  id: string;
  subscriptionTier: 'free' | 'pro';
  billingStatus: string;
  provider: BillingProvider;
  interval: string;
  currency: string;
  amountMinor: number;
  amountLabel: string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface BillingSummary {
  enabled: boolean;
  currentSubscription: BillingCurrentSubscription | null;
  searchQuota: SearchQuota;
  availablePlans: BillingPlan[];
}

export interface BillingLimitError {
  error?: string;
  code: 'daily_limit_reached';
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
  upgradeOptions: BillingPlan[];
}

export interface AuthUser {
  userId: string;
  email: string;
  subscriptionTier: 'free' | 'pro';
  billingStatus: string;
  billingProvider?: string | null;
  billingInterval?: string | null;
  billingCurrency?: string | null;
  billingCurrentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  searchQuota: SearchQuota;
  searchRunSummary: SearchRunSummary;
}

export type TimelineSeverity = 'info' | 'success' | 'warning' | 'error';
export type TimelineStatus = 'queued' | 'running' | 'completed' | 'failed';
export type JobSourceType = 'job_board' | 'ats' | 'company_careers';
export type JobQueueStatus = 'queued' | 'extracting' | 'verified' | 'ready' | 'failed';
export type SearchCacheMode = 'exact' | 'intent';

export interface SearchCacheState {
  mode: SearchCacheMode;
  cachedAt: string;
  ageMs: number;
  refreshing: boolean;
}

export interface SearchSession {
  id: string;
  type: SearchType;
  status: 'running' | 'paused' | 'completed' | 'error';
  name: string;
  createdAt: string;
  intakeData: any;
  timeline: TimelineItem[];
  results: SearchResult[];
}

export interface TimelineItem {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  details?: string;
  detailLines?: string[];
  status?: TimelineStatus;
  severity?: TimelineSeverity;
  isExpanded?: boolean;
}

export interface SearchResult {
  id: string;
  opportunityType?: SearchType;
  title: string;
  organization: string;
  location: string;
  deadline?: string;
  fitScore: 'High' | 'Medium' | 'Low';
  tags: string[];
  link: string;
  status: 'new' | 'shortlisted' | 'saved' | 'applied' | 'needs-info';
  isSuspicious?: boolean;
  snippet?: string;
  relevance?: number;
  sourceName: string;
  sourceDomain: string;
  sourceType: JobSourceType;
  sourceVerified: boolean;
  queueStatus: JobQueueStatus;
  queuePosition?: number;
  salary?: string;
  employmentType?: string;
  workMode?: string;
  postedDate?: string;
  studyLevel?: string;
  fundingType?: string;
  fundingAmount?: string;
  whoCanApply?: string;
  locationEligibility?: string;
  officialApplicationLink?: string;
  processingTime?: string;
  matchReason?: string;
  requirements?: string[];
  responsibilities?: string[];
  benefits?: string[];
  metadata?: Record<string, unknown> | null;
  seenOn?: Array<{
    sourceName: string;
    sourceDomain: string;
    sourceVerified: boolean;
  }>;
}

export interface SavedOpportunity {
  id: string;
  type: 'job' | 'scholarship' | 'grant' | 'visa';
  title: string;
  organization?: string | null;
  location?: string | null;
  description?: string | null;
  requirements?: string[];
  link?: string | null;
  deadline?: string | null;
  matchScore?: number | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}
