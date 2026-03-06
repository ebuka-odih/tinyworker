export enum SearchType {
  JOB = 'job',
  SCHOLARSHIP = 'scholarship',
  VISA = 'visa',
}

export interface AuthUser {
  userId: string;
  email: string;
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
  matchReason?: string;
  requirements?: string[];
  responsibilities?: string[];
  benefits?: string[];
}
