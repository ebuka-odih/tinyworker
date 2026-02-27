export type TinyfishBrowserProfile = 'lite' | 'stealth'

export interface TinyfishRunRequest {
  url: string
  goal: string
  browser_profile?: TinyfishBrowserProfile
  proxy_config?: {
    enabled: boolean
    country_code?: 'US' | 'GB' | 'CA' | 'DE' | 'FR' | 'JP' | 'AU'
  }
  feature_flags?: {
    enable_agent_memory?: boolean
  }
  api_integration?: string
}

export interface TinyfishSseEvent {
  type: 'STARTED' | 'STREAMING_URL' | 'PROGRESS' | 'HEARTBEAT' | 'COMPLETE' | string
  runId?: string
  timestamp?: string
  purpose?: string
  streamingUrl?: string
  status?: 'COMPLETED' | 'FAILED' | 'CANCELLED' | string
  error?: string
  resultJson?: any
}

export interface UserProfile {
  name?: string
  email?: string
  goal?: 'scholarship' | 'job' | 'visa'
  targetCountry?: string
  educationLevel?: string
  skills?: string[]
  experience?: string[]
}

export interface CVData {
  id: string
  name: string
  version: number
  content: string
  parsedData?: {
    name: string
    email: string
    skills: string[]
    experience: { title: string; company: string; duration: string; description: string }[]
    education: { degree: string; school: string; year: string }[]
  }
  healthScore?: {
    total: number
    atsReadability: number
    impact: number
    skills: number
    formatting: number
    suggestions: string[]
  }
  createdAt: string
}

export interface Opportunity {
  id: string
  type: 'job' | 'scholarship' | 'visa'
  title: string
  organization: string
  location: string
  description: string
  requirements: string[]
  link: string
  deadline?: string
  matchScore?: number
  visaStatus?: string
}

export interface Application {
  id: string
  opportunityId: string
  status: 'saved' | 'preparing' | 'ready' | 'applied' | 'interview' | 'offer' | 'rejected'
  tailoredCVId?: string
  coverLetterId?: string
  notes?: string
  updatedAt: string
}

export interface Document {
  id: string
  type: 'cv' | 'cover_letter' | 'sop'
  title: string
  content: string
  opportunityId?: string
  createdAt: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  type?: 'text' | 'options' | 'results' | 'progress'
  options?: string[]
  results?: Opportunity[]
}
