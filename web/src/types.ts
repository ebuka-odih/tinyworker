export enum SearchType {
  JOB = 'job',
  SCHOLARSHIP = 'scholarship',
  VISA = 'visa',
}

export type TimelineSeverity = 'info' | 'success' | 'warning' | 'error';
export type TimelineStatus = 'queued' | 'running' | 'completed' | 'failed';

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
}
