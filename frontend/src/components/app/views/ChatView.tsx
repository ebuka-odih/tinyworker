import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Bot,
  ExternalLink,
  History,
  LoaderCircle,
  MessageSquarePlus,
  PauseCircle,
  PlayCircle,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  Application,
  AuthUser,
  CandidateIntent,
  CandidateProfile,
  CVData,
  Document,
  Opportunity,
} from '../../../types'
import { tinyfishService } from '../../../services/tinyfishService'
import { Badge, Button, Card } from '../AppPrimitives'

type FlowDomain = 'jobs' | 'scholarships'
type WorkspaceMode = 'execution' | 'chat' | 'matches' | 'settings'
type ExecutionStatus = 'running' | 'paused' | 'completed'
type ExecutionStage = 'early' | 'scanning' | 'shortlisting' | 'finalizing'

type FlowStep = {
  key: string
  prompt: string
  options: string[]
  manualTextAccepted?: boolean
  manualPrompt?: string
}

type FlowState = {
  domain: FlowDomain
  stepIndex: number
  criteria: Record<string, string>
}

type OptionContext = { type: 'root' } | { type: 'flow'; flow: FlowState }

type LocalChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'text' | 'options' | 'results' | 'progress'
  options?: string[]
  results?: Opportunity[]
  optionContext?: OptionContext
}

type ChatSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: LocalChatMessage[]
  flow: FlowState | null
  execution: SearchExecutionState | null
  lastJobCriteria: Record<string, string> | null
}

type ExecutionTimelineItem = {
  id: string
  content: string
  createdAt: string
  stage: ExecutionStage
  resultsFound?: number
}

type SearchExecutionState = {
  status: ExecutionStatus
  stage: ExecutionStage
  timeline: ExecutionTimelineItem[]
  resultsFound: number
  lastCompletedStep: string | null
}

type PersistedChatState = {
  activeSessionId: string | null
  sessions: ChatSession[]
}

const ROOT_OPTIONS = [
  'Scholarships',
  'Jobs',
  'Visa Requirements',
  'Upload CV',
  'Import LinkedIn Link',
  'View Matches',
  'Settings',
]
const REVIEW_OPTIONS = ['Run search', 'Edit', 'Save & monitor']

const JOB_STEPS: FlowStep[] = [
  { key: 'job_level', prompt: 'What role level are you targeting?', options: ['Internship', 'Entry', 'Mid-level', 'Senior'] },
  {
    key: 'job_title',
    prompt: 'Title keywords? Choose one or type manually.',
    options: [
      'Backend Developer',
      'Customer Support Specialist',
      'Sales Executive',
      'Marketing Specialist',
      'Copywriter',
      'Fullstack Developer',
      'AI Engineer',
      'Type manually',
    ],
    manualTextAccepted: true,
    manualPrompt: 'Type your preferred title keywords.',
  },
  {
    key: 'job_focus',
    prompt: 'Industry or field focus?',
    options: ['Software', 'Marketing', 'Sales', 'Operations', 'Customer Service', 'Any', 'Type manually'],
    manualTextAccepted: true,
    manualPrompt: 'Type your preferred focus area (for example: FinTech, HealthTech, E-commerce).',
  },
  {
    key: 'job_location',
    prompt: 'Target country/location? Choose one or type manually.',
    options: ['Global', 'UK', 'US', 'Canada', 'Germany', 'Nigeria', 'Type manually'],
    manualTextAccepted: true,
    manualPrompt: 'Type target location (country/city or Remote).',
  },
  { key: 'job_mode', prompt: 'Preferred work mode?', options: ['Remote', 'Hybrid', 'Onsite'] },
  {
    key: 'job_source',
    prompt: 'Preferred source(s)?',
    options: ['LinkedIn Jobs', 'Indeed', 'Jobberman', 'MyJobMag', 'Djinni', 'Company Career Pages', 'All + Other Trusted Sites'],
  },
  {
    key: 'job_stack',
    prompt: 'Skills/tools to prioritize? Choose, skip, or type manually.',
    options: ['Excel', 'CRM', 'Canva', 'Python', 'Laravel', 'Skip', 'Type manually'],
    manualTextAccepted: true,
    manualPrompt: 'Type skills/tools (comma-separated).',
  },
  { key: 'job_visa', prompt: 'Need visa sponsorship?', options: ['Yes', 'No', 'Skip'] },
  {
    key: 'job_salary',
    prompt: 'Salary band?',
    options: ['Under N300k/month', 'N300k - N700k/month', 'N700k - N1.5m/month', 'Above N1.5m/month', 'Skip', 'Type manually'],
    manualTextAccepted: true,
    manualPrompt: 'Type your salary preference.',
  },
  { key: 'job_company', prompt: 'Company type?', options: ['Startup', 'Enterprise', 'Any'] },
  { key: 'review', prompt: 'Review your job criteria before running search.', options: REVIEW_OPTIONS },
]

const SCHOLARSHIP_STEPS: FlowStep[] = [
  { key: 'sch_level', prompt: 'What are you looking for?', options: ["Master's", 'PhD', 'Short course', 'Exchange'] },
  {
    key: 'sch_country',
    prompt: 'Destination country? Choose one or type manually.',
    options: ['Germany', 'Canada', 'UK', 'USA', 'Type manually'],
    manualTextAccepted: true,
    manualPrompt: 'Type your destination country.',
  },
  {
    key: 'sch_field',
    prompt: 'Field/program keywords?',
    options: [
      'Artificial Intelligence / Machine Learning',
      'Computer Science',
      'Data Science',
      'Business / MBA',
      'Engineering',
      'Public Health',
      'Any',
      'Type manually',
    ],
    manualTextAccepted: true,
    manualPrompt: 'Type your field/program keywords.',
  },
  { key: 'sch_funding', prompt: 'Funding level?', options: ['Full', 'Partial', 'Any'] },
  { key: 'sch_tuition', prompt: 'Tuition preference?', options: ['Full tuition', 'Half tuition', 'Any'] },
  { key: 'sch_intake', prompt: 'Preferred intake season?', options: ['Summer', 'Winter', 'Any'] },
  {
    key: 'sch_year',
    prompt: 'Which intake year?',
    options: ['2026', '2027', '2028', 'Type manually'],
    manualTextAccepted: true,
    manualPrompt: 'Type intake year (example: 2026).',
  },
  {
    key: 'sch_eligibility_text',
    prompt: 'Any eligibility notes?',
    options: ['No special constraints', 'Use my profile only', 'Type manually'],
    manualTextAccepted: true,
    manualPrompt: 'Type eligibility notes or constraints.',
  },
  {
    key: 'sch_deadline',
    prompt: 'Deadline urgency?',
    options: ['Deadline within 30 days', 'Deadline within 60 days', 'Deadline within 90 days', 'Any deadline'],
  },
  { key: 'review', prompt: 'Review your scholarship criteria before running search.', options: REVIEW_OPTIONS },
]

function stepsForDomain(domain: FlowDomain): FlowStep[] {
  return domain === 'jobs' ? JOB_STEPS : SCHOLARSHIP_STEPS
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function cloneFlowState(flow: FlowState): FlowState {
  return {
    domain: flow.domain,
    stepIndex: flow.stepIndex,
    criteria: { ...flow.criteria },
  }
}

function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now()}-${random}`
}

function withStepLabel(domain: FlowDomain, stepIndex: number, prompt: string): string {
  const total = stepsForDomain(domain).length
  return `Step ${stepIndex + 1}/${total}\n${prompt}`
}

function buildReviewSummary(flow: FlowState): string {
  const c = flow.criteria
  if (flow.domain === 'jobs') {
    return [
      withStepLabel('jobs', flow.stepIndex, 'Review your job criteria.'),
      '',
      `- Role level: ${c.job_level || 'Any'}`,
      `- Title keywords: ${c.job_title || 'Any'}`,
      `- Industry/field: ${c.job_focus || 'Any'}`,
      `- Location: ${c.job_location || 'Any'}`,
      `- Work mode: ${c.job_mode || 'Any'}`,
      `- Source: ${c.job_source || 'Any'}`,
      `- Skills/tools: ${c.job_stack || 'Any'}`,
      `- Visa sponsorship: ${c.job_visa || 'Skip'}`,
      `- Salary: ${c.job_salary || 'Skip'}`,
      `- Company type: ${c.job_company || 'Any'}`,
    ].join('\n')
  }

  return [
    withStepLabel('scholarships', flow.stepIndex, 'Review your scholarship criteria.'),
    '',
    `- Level: ${c.sch_level || 'Any'}`,
    `- Destination country: ${c.sch_country || 'Any'}`,
    `- Field: ${c.sch_field || 'Any'}`,
    `- Funding: ${c.sch_funding || 'Any'}`,
    `- Tuition: ${c.sch_tuition || 'Any'}`,
    `- Intake season: ${c.sch_intake || 'Any'}`,
    `- Intake year: ${c.sch_year || 'Any'}`,
    `- Eligibility notes: ${c.sch_eligibility_text || 'None'}`,
    `- Deadline urgency: ${c.sch_deadline || 'Any'}`,
  ].join('\n')
}

function initialAssistantMessage(): LocalChatMessage {
  return {
    id: makeId('msg'),
    role: 'assistant',
    content:
      "Hi! I'm your Opportunity Agent. I can help you find scholarships, jobs, or visa requirements. What's our goal today?",
    type: 'options',
    options: ROOT_OPTIONS,
    optionContext: { type: 'root' },
  }
}

function createSession(title = 'New Search'): ChatSession {
  const now = new Date().toISOString()
  return {
    id: makeId('session'),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [initialAssistantMessage()],
    flow: null,
    execution: null,
    lastJobCriteria: null,
  }
}

function createExecutionState(): SearchExecutionState {
  return {
    status: 'running',
    stage: 'early',
    timeline: [],
    resultsFound: 0,
    lastCompletedStep: null,
  }
}

function stageLabel(stage: ExecutionStage): string {
  if (stage === 'early') return 'Early stage'
  if (stage === 'scanning') return 'Active scanning'
  if (stage === 'shortlisting') return 'Shortlisting'
  return 'Finalizing matches'
}

function storageKeyForOwner(owner: string): string {
  return `tinyworker.chat.sessions.${owner}`
}

function safePreview(text: string): string {
  return text.length > 64 ? `${text.slice(0, 64)}...` : text
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

function isSessionEmptyDraft(session: ChatSession): boolean {
  const hasUserMessage = session.messages.some(
    (msg) => msg.role === 'user' && msg.content.trim().length > 0,
  )
  const isDefaultTitle = !session.title.trim() || session.title === 'New Search'
  return !hasUserMessage && !session.flow && isDefaultTitle
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export function ChatView({
  authUser,
  cvs,
  profiles,
  candidateIntent,
  opportunities,
  applications,
  documents,
  cvError,
  linkedinImportError,
  onImportOpportunities,
  onUploadCv,
  onStartLinkedinImport,
  onCreateApplication,
  onDeleteDocument,
  onSignOut,
  sessionOwnerId,
}: {
  authUser: AuthUser | null
  cvs: CVData[]
  profiles: CandidateProfile[]
  candidateIntent: CandidateIntent | null
  opportunities: Opportunity[]
  applications: Application[]
  documents: Document[]
  cvError: string | null
  linkedinImportError: string | null
  onImportOpportunities: (items: Opportunity[]) => Promise<void>
  onUploadCv: (file: File) => Promise<void>
  onStartLinkedinImport: (linkedinUrl: string) => Promise<void>
  onCreateApplication: (opportunityId: string, status?: Application['status']) => Promise<void>
  onDeleteDocument: (id: string) => Promise<void>
  onSignOut: () => void
  sessionOwnerId: string
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [busySessionIds, setBusySessionIds] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('chat')
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false)
  const [awaitingLinkedinUrlSessionId, setAwaitingLinkedinUrlSessionId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoIntentSearchHandledRef = useRef<string | null>(null)
  const runTokenRef = useRef<Record<string, string>>({})
  const stopRequestedRef = useRef<Record<string, boolean>>({})
  const pausedExecutionRef = useRef<Record<string, boolean>>({})
  const queuedExecutionRef = useRef<Record<string, ExecutionTimelineItem[]>>({})
  const completionWhilePausedRef = useRef<Record<string, boolean>>({})

  const storageKey = useMemo(() => storageKeyForOwner(sessionOwnerId || 'anon'), [sessionOwnerId])
  const intentSearchSignal = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('intentSearch')
  }, [location.search])

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [sessions],
  )

  const activeSession = useMemo(() => {
    if (!sessions.length) return null
    if (!activeSessionId) return sessions[0]
    return sessions.find((s) => s.id === activeSessionId) || sessions[0]
  }, [sessions, activeSessionId])

  const messages = activeSession?.messages || []
  const flow = activeSession?.flow || null
  const execution = activeSession?.execution || null
  const isActiveSessionBusy = Boolean(activeSession?.id && busySessionIds.includes(activeSession.id))

  const groupedOpportunities = useMemo(() => {
    return {
      jobs: opportunities.filter((o) => o.type === 'job'),
      scholarships: opportunities.filter((o) => o.type === 'scholarship'),
      visas: opportunities.filter((o) => o.type === 'visa'),
    }
  }, [opportunities])

  const setSessionBusy = (sessionId: string, busy: boolean) => {
    setBusySessionIds((prev) => {
      if (busy) return prev.includes(sessionId) ? prev : [...prev, sessionId]
      return prev.filter((id) => id !== sessionId)
    })
  }

  const updateSession = (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) return session
        const next = updater(session)
        return {
          ...next,
          updatedAt: new Date().toISOString(),
        }
      }),
    )
  }

  const appendAssistantMessage = (
    sessionId: string,
    message: Omit<LocalChatMessage, 'id' | 'role' | 'optionContext'>,
    optionContext?: OptionContext,
  ) => {
    updateSession(sessionId, (session) => ({
      ...session,
      messages: [
        ...session.messages,
        {
          id: makeId('msg'),
          role: 'assistant',
          ...message,
          optionContext,
        },
      ],
    }))
  }

  const appendUserMessage = (sessionId: string, content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    updateSession(sessionId, (session) => ({
      ...session,
      title: session.title === 'New Search' ? safePreview(trimmed) : session.title,
      messages: [...session.messages, { id: makeId('msg'), role: 'user', content: trimmed }],
    }))
  }

  const setSessionFlow = (sessionId: string, nextFlow: FlowState | null) => {
    updateSession(sessionId, (session) => ({ ...session, flow: nextFlow ? cloneFlowState(nextFlow) : null }))
  }

  const setSessionExecution = (
    sessionId: string,
    updater: (execution: SearchExecutionState | null) => SearchExecutionState | null,
  ) => {
    updateSession(sessionId, (session) => ({
      ...session,
      execution: updater(session.execution),
    }))
  }

  const appendExecutionTimeline = (
    sessionId: string,
    content: string,
    options?: { stage?: ExecutionStage; resultsFound?: number; force?: boolean },
  ) => {
    const nextStage = options?.stage || 'early'
    const item: ExecutionTimelineItem = {
      id: makeId('exec'),
      content,
      createdAt: new Date().toISOString(),
      stage: nextStage,
      resultsFound: options?.resultsFound,
    }

    if (!options?.force && pausedExecutionRef.current[sessionId]) {
      queuedExecutionRef.current[sessionId] = [...(queuedExecutionRef.current[sessionId] || []), item]
      return
    }

    setSessionExecution(sessionId, (current) => {
      const base = current || createExecutionState()
      return {
        ...base,
        stage: options?.stage || base.stage,
        timeline: [...base.timeline, item],
        resultsFound:
          typeof options?.resultsFound === 'number'
            ? options.resultsFound
            : typeof item.resultsFound === 'number'
              ? item.resultsFound
              : base.resultsFound,
        lastCompletedStep: content,
      }
    })
  }

  const flushQueuedExecution = (sessionId: string) => {
    const queued = queuedExecutionRef.current[sessionId] || []
    if (!queued.length) return

    setSessionExecution(sessionId, (current) => {
      const base = current || createExecutionState()
      const last = queued[queued.length - 1]
      const nextResults =
        typeof last.resultsFound === 'number'
          ? last.resultsFound
          : typeof base.resultsFound === 'number'
            ? base.resultsFound
            : 0
      return {
        ...base,
        stage: last.stage || base.stage,
        timeline: [...base.timeline, ...queued],
        resultsFound: nextResults,
        lastCompletedStep: last.content,
      }
    })

    queuedExecutionRef.current[sessionId] = []
  }

  const pauseExecution = (sessionId: string) => {
    if (!busySessionIds.includes(sessionId)) return
    pausedExecutionRef.current[sessionId] = true
    setSessionExecution(sessionId, (current) => {
      const base = current || createExecutionState()
      return { ...base, status: 'paused' }
    })
  }

  const resumeExecution = (sessionId: string) => {
    pausedExecutionRef.current[sessionId] = false
    setSessionExecution(sessionId, (current) => {
      const base = current || createExecutionState()
      return { ...base, status: 'running' }
    })
    flushQueuedExecution(sessionId)

    if (completionWhilePausedRef.current[sessionId]) {
      completionWhilePausedRef.current[sessionId] = false
      setSessionExecution(sessionId, (current) => {
        const base = current || createExecutionState()
        return { ...base, status: 'completed' }
      })
    }
  }

  const stopExecution = (sessionId: string) => {
    stopRequestedRef.current[sessionId] = true
    pausedExecutionRef.current[sessionId] = false
    completionWhilePausedRef.current[sessionId] = false
    queuedExecutionRef.current[sessionId] = []
    appendExecutionTimeline(sessionId, 'Search stopped. You can refine your goal or ask the agent for next steps.', {
      stage: 'finalizing',
      force: true,
    })
    setSessionExecution(sessionId, (current) => {
      const base = current || createExecutionState()
      return { ...base, status: 'completed', stage: 'finalizing' }
    })
    setSessionBusy(sessionId, false)
  }

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, workspaceMode])

  useEffect(() => {
    setIsHydrated(false)
    setInputValue('')
    setWorkspaceMode('chat')
    setIsMobileHistoryOpen(false)
    setAwaitingLinkedinUrlSessionId(null)
    runTokenRef.current = {}
    stopRequestedRef.current = {}
    pausedExecutionRef.current = {}
    queuedExecutionRef.current = {}
    completionWhilePausedRef.current = {}

    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedChatState
        const loaded = Array.isArray(parsed?.sessions) ? parsed.sessions : []
        const normalized = loaded
          .filter((session) => session && Array.isArray(session.messages) && typeof session.id === 'string')
          .map((session) => ({
            ...session,
            messages: session.messages.map((msg) => ({ ...msg, id: msg.id || makeId('msg') })),
            flow: session.flow ? cloneFlowState(session.flow) : null,
            execution: session.execution
              ? {
                  ...session.execution,
                  timeline: Array.isArray(session.execution.timeline)
                    ? session.execution.timeline.map((item) => ({
                        ...item,
                        id: item.id || makeId('exec'),
                        stage: item.stage || session.execution.stage || 'early',
                      }))
                    : [],
                }
              : null,
            lastJobCriteria:
              session.lastJobCriteria && typeof session.lastJobCriteria === 'object'
                ? { ...session.lastJobCriteria }
                : null,
          }))

        if (normalized.length) {
          setSessions(normalized)
          const preferredActive = parsed.activeSessionId
          const active = normalized.find((s) => s.id === preferredActive) ? preferredActive : normalized[0].id
          setActiveSessionId(active)
          setIsHydrated(true)
          return
        }
      }
    } catch {
      // ignore malformed storage
    }

    const seed = createSession()
    setSessions([seed])
    setActiveSessionId(seed.id)
    setIsHydrated(true)
  }, [storageKey])

  useEffect(() => {
    if (!isHydrated) return
    const payload: PersistedChatState = {
      activeSessionId,
      sessions,
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [isHydrated, storageKey, sessions, activeSessionId])

  useEffect(() => {
    if (!activeSession?.execution) return
    if (activeSession.execution.status === 'running' || activeSession.execution.status === 'paused') {
      setWorkspaceMode('execution')
    }
  }, [activeSession?.execution, activeSession?.id])

  const askCurrentStep = (sessionId: string, nextFlow: FlowState) => {
    const flowSnapshot = cloneFlowState(nextFlow)
    const step = stepsForDomain(nextFlow.domain)[nextFlow.stepIndex]

    if (step.key === 'review') {
      appendAssistantMessage(
        sessionId,
        {
          content: buildReviewSummary(nextFlow),
          type: 'options',
          options: step.options,
        },
        { type: 'flow', flow: flowSnapshot },
      )
      return
    }

    appendAssistantMessage(
      sessionId,
      {
        content: withStepLabel(nextFlow.domain, nextFlow.stepIndex, step.prompt),
        type: 'options',
        options: step.options,
      },
      { type: 'flow', flow: flowSnapshot },
    )
  }

  const startNewSession = () => {
    const reusable = [...sessions]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .find(isSessionEmptyDraft)

    if (reusable) {
      setActiveSessionId(reusable.id)
      setWorkspaceMode('chat')
      setInputValue('')
      setIsMobileHistoryOpen(false)
      setAwaitingLinkedinUrlSessionId(null)
      return
    }

    const next = createSession()
    setSessions((prev) => [next, ...prev])
    setActiveSessionId(next.id)
    setWorkspaceMode('chat')
    setInputValue('')
    setIsMobileHistoryOpen(false)
    setAwaitingLinkedinUrlSessionId(null)
  }

  const deleteSession = (sessionId: string) => {
    const target = sessions.find((session) => session.id === sessionId)
    const label = target?.title?.trim() || 'New Search'
    const isBusy = busySessionIds.includes(sessionId)
    const confirmed = window.confirm(
      isBusy
        ? `Delete "${label}" chat history? A search is still running for this chat.`
        : `Delete "${label}" chat history? This cannot be undone.`,
    )
    if (!confirmed) return

    setSessions((prev) => {
      const remaining = prev.filter((session) => session.id !== sessionId)
      if (!remaining.length) {
        const seed = createSession()
        setActiveSessionId(seed.id)
        return [seed]
      }

      const activeStillExists = remaining.some((session) => session.id === activeSessionId)
      if (activeSessionId === sessionId || !activeStillExists) {
        const [nextActive] = [...remaining].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        if (nextActive) setActiveSessionId(nextActive.id)
      }
      return remaining
    })

    setBusySessionIds((prev) => prev.filter((id) => id !== sessionId))
    delete runTokenRef.current[sessionId]
    delete stopRequestedRef.current[sessionId]
    delete pausedExecutionRef.current[sessionId]
    delete queuedExecutionRef.current[sessionId]
    delete completionWhilePausedRef.current[sessionId]
    setAwaitingLinkedinUrlSessionId((prev) => (prev === sessionId ? null : prev))
    setInputValue('')
    setWorkspaceMode('chat')
    setIsMobileHistoryOpen(false)
  }

  const restartFlow = (sessionId: string, domain: FlowDomain) => {
    const nextFlow: FlowState = { domain, stepIndex: 0, criteria: {} }
    setSessionFlow(sessionId, nextFlow)
    askCurrentStep(sessionId, nextFlow)
  }

  const runJobSearch = async (sessionId: string, criteria: Record<string, string>) => {
    const inFlightToken = runTokenRef.current[sessionId]
    if (inFlightToken && !stopRequestedRef.current[sessionId]) {
      setWorkspaceMode('execution')
      return
    }

    const runToken = makeId('run')
    runTokenRef.current[sessionId] = runToken
    stopRequestedRef.current[sessionId] = false
    pausedExecutionRef.current[sessionId] = false
    queuedExecutionRef.current[sessionId] = []
    completionWhilePausedRef.current[sessionId] = false

    setWorkspaceMode('execution')
    setSessionBusy(sessionId, true)
    setSessionExecution(sessionId, () => createExecutionState())
    updateSession(sessionId, (session) => ({ ...session, lastJobCriteria: { ...criteria } }))

    try {
      const stillActive = () => {
        return runTokenRef.current[sessionId] === runToken && !stopRequestedRef.current[sessionId]
      }

      const title = criteria.job_title && normalizeText(criteria.job_title) !== 'skip' ? criteria.job_title : 'Software Engineer'
      const focus = criteria.job_focus && normalizeText(criteria.job_focus) !== 'any' ? criteria.job_focus : ''
      const location = criteria.job_location && normalizeText(criteria.job_location) !== 'global' ? criteria.job_location : 'Remote'
      const visaHint = normalizeText(criteria.job_visa || '') === 'yes' ? 'visa sponsorship' : ''
      const mode = criteria.job_mode && normalizeText(criteria.job_mode) !== 'any' ? criteria.job_mode : ''
      const stack = criteria.job_stack && normalizeText(criteria.job_stack) !== 'skip' ? criteria.job_stack : ''
      const salary = criteria.job_salary && normalizeText(criteria.job_salary) !== 'skip' ? criteria.job_salary : ''
      const query = [title, focus, location, mode, stack, visaHint, salary].filter(Boolean).join(' ').trim()

      appendExecutionTimeline(sessionId, 'Validating your criteria', { stage: 'early' })
      await wait(400)
      if (!stillActive()) return

      appendExecutionTimeline(sessionId, 'Normalizing job titles and search terms', { stage: 'early' })
      await wait(420)
      if (!stillActive()) return

      appendExecutionTimeline(
        sessionId,
        `Launching async scans across LinkedIn, Google Jobs, and Indeed for ${location}`,
        { stage: 'scanning' },
      )

      const results = await tinyfishService.searchJobsLinkedIn(query, criteria)
      if (!stillActive()) return

      appendExecutionTimeline(sessionId, 'Filtering visa-friendly and profile-compatible opportunities', {
        stage: 'shortlisting',
        resultsFound: results.length,
      })
      await wait(280)
      if (!stillActive()) return

      await onImportOpportunities(results)
      if (!stillActive()) return

      appendExecutionTimeline(sessionId, 'Ranking matches based on your CV alignment', {
        stage: 'shortlisting',
        resultsFound: results.length,
      })
      await wait(220)
      if (!stillActive()) return

      appendExecutionTimeline(sessionId, `Finalizing ${results.length} saved match${results.length === 1 ? '' : 'es'}`, {
        stage: 'finalizing',
        resultsFound: results.length,
      })

      appendAssistantMessage(sessionId, {
        content: [
          'Search context used:',
          `- Role level: ${criteria.job_level || 'Any'}`,
          `- Title keywords: ${criteria.job_title || 'Any'}`,
          `- Industry/field: ${criteria.job_focus || 'Any'}`,
          `- Location: ${criteria.job_location || 'Any'}`,
          `- Work mode: ${criteria.job_mode || 'Any'}`,
          `- Source: ${criteria.job_source || 'Any'}`,
          `- Skills/tools: ${criteria.job_stack || 'Any'}`,
          `- Visa sponsorship: ${criteria.job_visa || 'Skip'}`,
          `- Salary: ${criteria.job_salary || 'Skip'}`,
          `- Company type: ${criteria.job_company || 'Any'}`,
        ].join('\n'),
      })

      appendAssistantMessage(sessionId, {
        content: results.length
          ? 'Search complete. Here are roles I found:'
          : 'Search completed, but no role cards were returned from this run. Try another query or broaden filters.',
        type: 'results',
        results,
      })

      appendAssistantMessage(
        sessionId,
        {
          content: 'Search run completed. You can continue scanning, open matches, or ask the agent.',
          type: 'options',
          options: ['Continue Scanning', 'View Matches', 'Ask the Agent', 'Settings'],
        },
        { type: 'root' },
      )

      if (pausedExecutionRef.current[sessionId]) {
        completionWhilePausedRef.current[sessionId] = true
      } else {
        setSessionExecution(sessionId, (current) => {
          const base = current || createExecutionState()
          return { ...base, status: 'completed', stage: 'finalizing' }
        })
      }
    } catch (e: any) {
      if (stopRequestedRef.current[sessionId]) return
      appendExecutionTimeline(sessionId, 'Search run failed. Returning error details.', {
        stage: 'finalizing',
        force: true,
      })
      setSessionExecution(sessionId, (current) => {
        const base = current || createExecutionState()
        return { ...base, status: 'completed', stage: 'finalizing' }
      })
      appendAssistantMessage(sessionId, {
        content: e?.message || 'Job search failed. Please try again.',
      })

      appendAssistantMessage(
        sessionId,
        {
          content: 'Choose next action.',
          type: 'options',
          options: ['Continue Scanning', 'View Matches', 'Ask the Agent'],
        },
        { type: 'root' },
      )
    } finally {
      setSessionFlow(sessionId, null)
      if (runTokenRef.current[sessionId] === runToken) {
        runTokenRef.current[sessionId] = ''
        setSessionBusy(sessionId, false)
      }
    }
  }

  const runScholarshipSearch = async (sessionId: string) => {
    setWorkspaceMode('execution')
    setSessionExecution(sessionId, (current) => {
      const base = current || createExecutionState()
      return { ...base, status: 'running' }
    })
    appendExecutionTimeline(sessionId, 'Validating your scholarship criteria', { stage: 'early', force: true })
    await wait(180)
    appendExecutionTimeline(sessionId, 'Preparing destination and funding filters', { stage: 'scanning', force: true })
    await wait(220)
    appendExecutionTimeline(sessionId, 'Scholarship live search integration is not wired yet in web chat', {
      stage: 'finalizing',
      force: true,
    })
    setSessionExecution(sessionId, (current) => {
      const base = current || createExecutionState()
      return { ...base, status: 'completed', stage: 'finalizing' }
    })

    appendAssistantMessage(sessionId, {
      content:
        'Scholarship live search integration is next. Your scholarship criteria has been captured and is ready for backend execution.',
    })

    appendAssistantMessage(
      sessionId,
      {
        content: 'Choose next action.',
        type: 'options',
        options: ['New Scholarships Search', 'Ask the Agent', 'View Matches'],
      },
      { type: 'root' },
    )

    setSessionFlow(sessionId, null)
  }

  const buildIntentJobCriteria = (intent: CandidateIntent | null): Record<string, string> => {
    const roles = Array.isArray(intent?.targetRoles) ? intent?.targetRoles.filter(Boolean) : []
    const locations = Array.isArray(intent?.targetLocations) ? intent?.targetLocations.filter(Boolean) : []
    const industries = Array.isArray(intent?.industries) ? intent?.industries.filter(Boolean) : []
    const modes = Array.isArray(intent?.workModes) ? intent?.workModes.filter(Boolean) : []

    const salaryLabel =
      typeof intent?.salaryMin === 'number' || typeof intent?.salaryMax === 'number'
        ? `${intent.salaryCurrency || ''} ${intent.salaryMin ?? '?'} - ${intent.salaryMax ?? '?'}`.trim()
        : 'Skip'

    return {
      job_level: 'Mid-level',
      job_title: roles.length ? roles.join(', ') : 'Software Engineer',
      job_focus: industries[0] || 'Any',
      job_location: locations[0] || 'Global',
      job_mode: modes[0] || 'Remote',
      job_source: 'All + Other Trusted Sites',
      job_stack: 'Skip',
      job_visa: intent?.visaRequired === true ? 'Yes' : intent?.visaRequired === false ? 'No' : 'Skip',
      job_salary: salaryLabel,
      job_company: 'Any',
    }
  }

  useEffect(() => {
    if (!isHydrated || !intentSearchSignal) return
    if (autoIntentSearchHandledRef.current === intentSearchSignal) return

    autoIntentSearchHandledRef.current = intentSearchSignal

    const nextSession = createSession('Intent Search')
    setSessions((prev) => [nextSession, ...prev])
    setActiveSessionId(nextSession.id)
    setWorkspaceMode('execution')
    setInputValue('')
    setIsMobileHistoryOpen(false)
    setAwaitingLinkedinUrlSessionId(null)

    setSessionExecution(nextSession.id, () => createExecutionState())
    appendExecutionTimeline(nextSession.id, 'Using your saved criteria', { stage: 'early', force: true })

    const goal = candidateIntent?.goal || 'job'

    if (goal === 'scholarship') {
      void runScholarshipSearch(nextSession.id)
    } else if (goal === 'visa') {
      appendExecutionTimeline(nextSession.id, 'Validating visa intent', { stage: 'early', force: true })
      appendExecutionTimeline(nextSession.id, 'Visa live search is not wired yet in web chat', {
        stage: 'finalizing',
        force: true,
      })
      setSessionExecution(nextSession.id, (current) => {
        const base = current || createExecutionState()
        return { ...base, status: 'completed', stage: 'finalizing' }
      })
      appendAssistantMessage(nextSession.id, {
        content: 'Visa live search in web chat is not wired yet. Your visa intent is saved.',
      })
      appendAssistantMessage(
        nextSession.id,
        {
          content: 'Choose next action.',
          type: 'options',
          options: ['Jobs', 'Scholarships', 'Ask the Agent', 'View Matches'],
        },
        { type: 'root' },
      )
    } else {
      void runJobSearch(nextSession.id, buildIntentJobCriteria(candidateIntent))
    }

    const params = new URLSearchParams(location.search)
    params.delete('intentSearch')
    const nextSearch = params.toString()
    const nextUrl = nextSearch ? `${location.pathname}?${nextSearch}` : location.pathname
    window.history.replaceState({}, '', nextUrl)
  }, [candidateIntent, intentSearchSignal, isHydrated, location.pathname, location.search])

  const handleRootInput = async (sessionId: string, value: string) => {
    const normalized = normalizeText(value)

    if (
      normalized === normalizeText('Jobs') ||
      normalized === normalizeText('New Jobs Search') ||
      normalized === normalizeText('Retry Jobs Search')
    ) {
      setWorkspaceMode('chat')
      restartFlow(sessionId, 'jobs')
      return
    }

    if (normalized === normalizeText('Continue Scanning')) {
      const session = sessions.find((s) => s.id === sessionId)
      if (session?.lastJobCriteria) {
        if (session.execution?.status === 'paused') resumeExecution(sessionId)
        void runJobSearch(sessionId, session.lastJobCriteria)
        return
      }
      restartFlow(sessionId, 'jobs')
      return
    }

    if (normalized === normalizeText('Scholarships') || normalized === normalizeText('New Scholarships Search')) {
      setWorkspaceMode('chat')
      restartFlow(sessionId, 'scholarships')
      return
    }

    if (normalized === normalizeText('View Matches') || normalized === normalizeText('Open Matches')) {
      setWorkspaceMode('matches')
      return
    }

    if (normalized === normalizeText('Ask the Agent')) {
      setWorkspaceMode('chat')
      appendAssistantMessage(sessionId, {
        content: 'Search context is active. Ask a specific question and I will respond with your current search state.',
      })
      return
    }

    if (normalized === normalizeText('Settings')) {
      setWorkspaceMode('settings')
      return
    }

    if (normalized === normalizeText('Import LinkedIn Link')) {
      setWorkspaceMode('chat')
      setAwaitingLinkedinUrlSessionId(sessionId)
      appendAssistantMessage(sessionId, {
        content: 'Paste your LinkedIn profile URL (for example: https://www.linkedin.com/in/your-name).',
      })
      return
    }

    if (normalized === normalizeText('Upload CV')) {
      setWorkspaceMode('chat')
      appendAssistantMessage(sessionId, {
        content: 'Opening file picker. Choose a PDF or DOCX CV.',
      })
      fileInputRef.current?.click()
      return
    }

    if (normalized === normalizeText('Visa Requirements')) {
      appendAssistantMessage(
        sessionId,
        {
          content: 'Visa flow in web chat is not yet wired. For now, use Jobs or Scholarships flow.',
          type: 'options',
          options: ROOT_OPTIONS,
        },
        { type: 'root' },
      )
      return
    }

    appendAssistantMessage(
      sessionId,
      {
        content: 'Pick a flow to continue.',
        type: 'options',
        options: ROOT_OPTIONS,
      },
      { type: 'root' },
    )
  }

  const handleFlowInput = async (sessionId: string, value: string, sourceFlow: FlowState) => {
    const activeFlow = cloneFlowState(sourceFlow)
    setSessionFlow(sessionId, activeFlow)

    const steps = stepsForDomain(activeFlow.domain)
    const step = steps[activeFlow.stepIndex]
    const normalized = normalizeText(value)

    if (step.key === 'review') {
      if (normalized === normalizeText('Run search')) {
        if (activeFlow.domain === 'jobs') {
          await runJobSearch(sessionId, activeFlow.criteria)
        } else {
          await runScholarshipSearch(sessionId)
        }
        return
      }

      if (normalized === normalizeText('Edit')) {
        restartFlow(sessionId, activeFlow.domain)
        return
      }

      if (normalized === normalizeText('Save & monitor')) {
        appendAssistantMessage(
          sessionId,
          {
            content: 'Save & monitor is captured. Monitor automation wiring will be enabled in the next phase.',
            type: 'options',
            options: ['Run search', 'Edit'],
          },
          { type: 'flow', flow: activeFlow },
        )
        return
      }

      appendAssistantMessage(
        sessionId,
        {
          content: 'Choose one of the review actions.',
          type: 'options',
          options: REVIEW_OPTIONS,
        },
        { type: 'flow', flow: activeFlow },
      )
      return
    }

    const matched = step.options.find((opt) => normalizeText(opt) === normalized)

    if (matched && normalizeText(matched) === normalizeText('Type manually')) {
      appendAssistantMessage(sessionId, {
        content: step.manualPrompt || 'Type your answer in the input below.',
      })
      return
    }

    if (!matched && !step.manualTextAccepted) {
      appendAssistantMessage(
        sessionId,
        {
          content: 'Select one of the options to continue.',
          type: 'options',
          options: step.options,
        },
        { type: 'flow', flow: activeFlow },
      )
      return
    }

    const answer = matched || value.trim()
    if (!answer) return

    const nextCriteria = { ...activeFlow.criteria, [step.key]: answer }
    const nextIndex = activeFlow.stepIndex + 1

    if (nextIndex >= steps.length) {
      setSessionFlow(sessionId, null)
      appendAssistantMessage(
        sessionId,
        {
          content: 'Flow completed.',
          type: 'options',
          options: ROOT_OPTIONS,
        },
        { type: 'root' },
      )
      return
    }

    const nextFlow: FlowState = {
      domain: activeFlow.domain,
      stepIndex: nextIndex,
      criteria: nextCriteria,
    }

    setSessionFlow(sessionId, nextFlow)
    askCurrentStep(sessionId, nextFlow)
  }

  const handleLinkedinUrlInput = async (sessionId: string, value: string): Promise<boolean> => {
    if (awaitingLinkedinUrlSessionId !== sessionId) return false

    const text = value.trim()
    if (!text) return true

    if (!text.includes('linkedin.com')) {
      appendAssistantMessage(sessionId, {
        content: 'This does not look like a LinkedIn URL. Paste a valid `linkedin.com` profile link.',
      })
      return true
    }

    setSessionBusy(sessionId, true)
    appendAssistantMessage(sessionId, {
      type: 'progress',
      content: 'Commentary: validating LinkedIn URL and starting profile import job.',
    })

    try {
      await onStartLinkedinImport(text)
      appendAssistantMessage(sessionId, {
        content: 'LinkedIn import requested. You can continue chatting while the backend processes the profile.',
      })
    } catch (e: any) {
      appendAssistantMessage(sessionId, {
        content: e?.message || 'LinkedIn import request failed.',
      })
    } finally {
      setAwaitingLinkedinUrlSessionId(null)
      setSessionBusy(sessionId, false)
    }

    return true
  }

  const handleUserInput = async (sessionId: string, value: string, context?: OptionContext) => {
    const trimmed = value.trim()
    if (!trimmed || busySessionIds.includes(sessionId)) return

    appendUserMessage(sessionId, trimmed)

    const consumedLinkedin = await handleLinkedinUrlInput(sessionId, trimmed)
    if (consumedLinkedin) return

    if (context?.type === 'flow') {
      await handleFlowInput(sessionId, trimmed, context.flow)
      return
    }

    if (context?.type === 'root') {
      await handleRootInput(sessionId, trimmed)
      return
    }

    const session = sessions.find((s) => s.id === sessionId)
    if (!session?.flow) {
      await handleRootInput(sessionId, trimmed)
      return
    }

    await handleFlowInput(sessionId, trimmed, session.flow)
  }

  const handleOption = async (option: string, sourceMessageId: string) => {
    if (!activeSession) return
    const source = activeSession.messages.find((msg) => msg.id === sourceMessageId)
    await handleUserInput(activeSession.id, option, source?.optionContext)
  }

  const handleSend = async () => {
    if (!activeSession || !inputValue.trim()) return
    const value = inputValue
    setInputValue('')
    await handleUserInput(activeSession.id, value)
  }

  const onFilePicked = async (file?: File) => {
    if (!file || !activeSession) return

    setSessionBusy(activeSession.id, true)
    appendAssistantMessage(activeSession.id, {
      type: 'progress',
      content: `Commentary: uploading ${file.name} and extracting text for profile intelligence.`,
    })

    try {
      await onUploadCv(file)
      appendAssistantMessage(activeSession.id, {
        content: `CV upload request completed for ${file.name}.`,
      })
    } catch (e: any) {
      appendAssistantMessage(activeSession.id, {
        content: e?.message || `Failed to upload ${file.name}.`,
      })
    } finally {
      setSessionBusy(activeSession.id, false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const primaryWorkspaceMode: WorkspaceMode = execution ? 'execution' : 'chat'
  const executionStatusLabel =
    execution?.status === 'running' ? 'Running' : execution?.status === 'paused' ? 'Paused' : 'Completed'
  const executionStatusTone =
    execution?.status === 'running'
      ? 'bg-emerald-500'
      : execution?.status === 'paused'
        ? 'bg-amber-500'
        : 'bg-slate-400'

  if (!activeSession) {
    return <div className="p-4 text-sm text-slate-500">Loading chat...</div>
  }

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => void onFilePicked(e.target.files?.[0])}
      />

      <aside className="hidden md:flex md:w-72 md:flex-col border-r border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900">History</div>
          <Button variant="outline" className="text-xs px-3 py-1" onClick={startNewSession}>
            <MessageSquarePlus size={14} /> New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sortedSessions.map((session) => {
            const preview = session.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || 'No messages yet'
            const active = session.id === activeSession.id
            return (
              <div key={session.id} className="relative">
                <button
                  onClick={() => {
                    setActiveSessionId(session.id)
                    setInputValue('')
                  }}
                  className={`w-full text-left p-3 pr-10 rounded-xl border transition-colors ${
                    active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{session.title || 'New Search'}</div>
                  <div className={`text-[11px] mt-1 truncate ${active ? 'text-slate-200' : 'text-slate-500'}`}>{safePreview(preview)}</div>
                  <div className={`text-[10px] mt-1 ${active ? 'text-slate-300' : 'text-slate-400'}`}>{formatUpdatedAt(session.updatedAt)}</div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                  className={`absolute right-2 top-2 p-1.5 rounded-md transition-colors ${
                    active
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                  title="Delete chat"
                  aria-label={`Delete ${session.title || 'chat'}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center justify-between shadow-sm z-20 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-lg shadow-slate-200 shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm truncate">Opportunity Agent Workspace</h3>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${execution ? executionStatusTone : 'bg-emerald-500'} ${
                    execution?.status === 'running' ? 'animate-pulse' : ''
                  }`}
                />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {execution ? `Search ${executionStatusLabel}` : 'Agent Ready'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {execution ? `• ${stageLabel(execution.stage)}` : '• Chat + Matches + Settings'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <button
              className="md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              onClick={() => setIsMobileHistoryOpen((v) => !v)}
              title="Toggle history"
            >
              <History size={18} />
            </button>
            <button className="md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors" onClick={startNewSession}>
              <MessageSquarePlus size={18} />
            </button>

            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {execution ? (
                <button
                  className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${
                    workspaceMode === 'execution' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                  onClick={() => setWorkspaceMode('execution')}
                >
                  Search
                </button>
              ) : null}
              <button
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${workspaceMode === 'chat' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                onClick={() => setWorkspaceMode('chat')}
              >
                Chat
              </button>
              <button
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${workspaceMode === 'matches' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                onClick={() => setWorkspaceMode('matches')}
              >
                Matches
              </button>
              <button
                className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${workspaceMode === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                onClick={() => setWorkspaceMode('settings')}
              >
                Settings
              </button>
            </div>

            <button
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              onClick={() => setWorkspaceMode(execution ? 'execution' : 'chat')}
            >
              <Search size={18} />
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors" onClick={() => setWorkspaceMode('settings')}>
              <Settings size={18} />
            </button>
          </div>
        </div>

        {isMobileHistoryOpen ? (
          <div className="md:hidden border-b border-slate-200 bg-white p-3 space-y-2 max-h-60 overflow-y-auto">
            <Button variant="outline" className="w-full" onClick={startNewSession}>
              <MessageSquarePlus size={14} /> New Search
            </Button>
            {sortedSessions.map((session) => (
              <div key={session.id} className="relative">
                <button
                  onClick={() => {
                    setActiveSessionId(session.id)
                    setInputValue('')
                    setIsMobileHistoryOpen(false)
                  }}
                  className={`w-full text-left p-3 pr-10 rounded-xl border ${
                    session.id === activeSession.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{session.title || 'New Search'}</div>
                  <div className={`text-[10px] mt-1 ${session.id === activeSession.id ? 'text-slate-300' : 'text-slate-400'}`}>
                    {formatUpdatedAt(session.updatedAt)}
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                  className={`absolute right-2 top-2 p-1.5 rounded-md transition-colors ${
                    session.id === activeSession.id
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                  title="Delete chat"
                  aria-label={`Delete ${session.title || 'chat'}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {workspaceMode === 'execution' && execution ? (
          <div className="flex-1 overflow-y-auto px-3 py-3 md:px-4 md:py-4 pb-24">
            <div className="mx-auto w-full max-w-5xl space-y-3 md:space-y-4">
              <Card className="border-slate-200 bg-white">
                <div className="flex flex-col gap-3 md:gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <h2 className="text-lg md:text-xl font-bold text-slate-900">Searching for opportunities</h2>
                      <p className="text-xs md:text-sm text-slate-500">Using your saved criteria</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] md:text-xs font-semibold text-slate-700">
                      <span
                        className={`h-2 w-2 rounded-full ${executionStatusTone} ${
                          execution.status === 'running' ? 'animate-pulse' : ''
                        }`}
                      />
                      {executionStatusLabel}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    {execution.status === 'running' ? (
                      <Button variant="outline" className="text-xs md:text-sm" onClick={() => pauseExecution(activeSession.id)}>
                        <PauseCircle size={14} /> Pause Search
                      </Button>
                    ) : execution.status === 'paused' ? (
                      <Button variant="outline" className="text-xs md:text-sm" onClick={() => resumeExecution(activeSession.id)}>
                        <PlayCircle size={14} /> Resume Search
                      </Button>
                    ) : null}
                    <Button variant="outline" className="text-xs md:text-sm" onClick={() => navigate('/guided-questions')}>
                      <SlidersHorizontal size={14} /> Refine Goal
                    </Button>
                    <Button
                      variant="outline"
                      className="text-xs md:text-sm"
                      onClick={() => stopExecution(activeSession.id)}
                      disabled={execution.status === 'completed'}
                    >
                      <Square size={14} /> Stop Search
                    </Button>
                    <Button variant="outline" className="text-xs md:text-sm" onClick={() => setWorkspaceMode('chat')}>
                      <Bot size={14} /> Ask the Agent
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="border-slate-200 bg-white">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">Live commentary timeline</div>
                    <div className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                      {stageLabel(execution.stage)}
                    </div>
                  </div>

                  {execution.timeline.length ? (
                    <div className="space-y-1.5 md:space-y-2">
                      {execution.timeline.map((item, index) => {
                        const isLatest = index === execution.timeline.length - 1
                        return (
                          <div
                            key={item.id}
                            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${
                              isLatest ? 'border-slate-300 bg-slate-100/70' : 'border-slate-100 bg-slate-50'
                            }`}
                          >
                            <span className={`mt-1.5 h-2 w-2 rounded-full ${isLatest ? 'bg-slate-700' : 'bg-slate-400'}`} />
                            <div className="min-w-0 flex-1">
                              <div className={`text-sm leading-snug ${isLatest ? 'text-slate-900 font-medium' : 'text-slate-800'}`}>
                                {item.content}
                              </div>
                              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                                {new Date(item.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                      Search execution is starting. Commentary will appear here.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Search stage</div>
                    <div className="mt-0.5 text-sm text-slate-900">{stageLabel(execution.stage)}</div>
                  </div>
                  {execution.lastCompletedStep ? (
                    <div className="max-w-[60%] text-right text-xs text-slate-500">
                      Last step: <span className="text-slate-700">{execution.lastCompletedStep}</span>
                    </div>
                  ) : null}
                </div>
              </Card>

              {execution.resultsFound > 0 ? (
                <Card className="border-emerald-200 bg-emerald-50/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-emerald-800">Results Found</div>
                      <div className="text-xs text-emerald-700">{execution.resultsFound} opportunities are now in your pipeline.</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                      <Button variant="outline" className="text-xs md:text-sm" onClick={() => setWorkspaceMode('matches')}>
                        View Matches
                      </Button>
                      <Button
                        variant="outline"
                        className="text-xs md:text-sm"
                        onClick={() => {
                          if (!activeSession.lastJobCriteria || isActiveSessionBusy) return
                          void runJobSearch(activeSession.id, activeSession.lastJobCriteria)
                        }}
                        disabled={!activeSession.lastJobCriteria || isActiveSessionBusy}
                      >
                        Continue Scanning
                      </Button>
                      {execution.status === 'running' ? (
                        <Button variant="outline" className="text-xs md:text-sm" onClick={() => pauseExecution(activeSession.id)}>
                          Pause
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              ) : null}

              {execution.status === 'paused' ? (
                <Card className="border-amber-200 bg-amber-50/60">
                  <div className="space-y-2.5">
                    <div>
                      <div className="text-sm font-semibold text-amber-800">Search paused</div>
                      <div className="text-xs text-amber-700">
                        Last completed step: {execution.lastCompletedStep || 'No completed step yet'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                      <Button variant="outline" className="text-xs md:text-sm" onClick={() => resumeExecution(activeSession.id)}>
                        Resume
                      </Button>
                      <Button variant="outline" className="text-xs md:text-sm" onClick={() => navigate('/guided-questions')}>
                        Refine Goal
                      </Button>
                      <Button variant="outline" className="text-xs md:text-sm" onClick={() => stopExecution(activeSession.id)}>
                        End Session
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        ) : null}

        {workspaceMode === 'chat' ? (
          <>
            {execution ? (
              <div className="px-4 pt-4">
                <div className="mx-auto w-full max-w-5xl">
                  <Card className="border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Search context attached</div>
                        <div className="text-xs text-slate-500">
                          {executionStatusLabel} • {stageLabel(execution.stage)}
                        </div>
                      </div>
                      <Button variant="outline" className="text-xs md:text-sm" onClick={() => setWorkspaceMode('execution')}>
                        Return To Search Timeline
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            ) : null}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-[180px] md:pb-44 scroll-smooth">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[85%] space-y-3">
                    {msg.type === 'progress' ? (
                      <div className="flex items-center gap-3 p-3.5 bg-slate-100/60 rounded-xl border border-slate-200/60 text-xs text-slate-700 font-medium">
                        <LoaderCircle size={16} className="animate-spin text-slate-700 shrink-0" />
                        <span className="leading-relaxed">{msg.content}</span>
                      </div>
                    ) : (
                      <div
                        className={`p-4 rounded-2xl shadow-sm leading-relaxed text-sm whitespace-pre-line ${
                          msg.role === 'user'
                            ? 'bg-slate-900 text-white rounded-br-none font-medium'
                            : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                        }`}
                      >
                        {msg.content}
                      </div>
                    )}

                    {msg.type === 'options' && (
                      <div className="flex flex-wrap gap-2">
                        {msg.options?.map((opt) => (
                          <Button
                            key={`${msg.id}-${opt}`}
                            variant="outline"
                            className="bg-white border-slate-200 hover:border-slate-900 hover:text-slate-900 shadow-sm py-2.5 px-5"
                            onClick={() => void handleOption(opt, msg.id)}
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                    )}

                    {msg.type === 'results' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {msg.results?.length ? (
                          msg.results.map((res) => (
                            <Card key={res.id} className="p-4 border-slate-200 hover:border-slate-400 transition-all group">
                              <div className="flex justify-between items-start mb-2">
                                <Badge color="slate">{res.type.toUpperCase()}</Badge>
                                {res.matchScore && <span className="text-[10px] font-bold text-slate-900">{res.matchScore}% Match</span>}
                              </div>
                              <div className="font-bold text-slate-900 group-hover:text-slate-600 transition-colors">{res.title || 'Untitled role'}</div>
                              <div className="text-xs text-slate-500 mb-2">{res.organization || 'Unknown org'} • {res.location || 'Unknown location'}</div>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {res.workMode && <Badge color="blue">{res.workMode}</Badge>}
                                {res.employmentType && <Badge color="green">{res.employmentType}</Badge>}
                                {res.seniority && <Badge color="amber">{res.seniority}</Badge>}
                                {res.salary && res.salary !== 'Not stated' && <Badge color="rose">{res.salary}</Badge>}
                              </div>
                              {res.matchReason ? (
                                <div className="text-[11px] text-slate-700 mb-2 leading-relaxed font-medium">Why this matches: {res.matchReason}</div>
                              ) : null}
                              <div className="text-[11px] text-slate-600 line-clamp-4 mb-2 leading-relaxed">{res.description || 'No description provided.'}</div>
                              {res.requirements?.length ? (
                                <div className="mb-3">
                                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Top requirements</div>
                                  <ul className="list-disc pl-4 space-y-0.5">
                                    {res.requirements.slice(0, 3).map((req, idx) => (
                                      <li key={`${res.id}-req-${idx}`} className="text-[11px] text-slate-700 leading-relaxed">
                                        {req}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="flex-1 text-[10px] py-1"
                                  onClick={() => void onCreateApplication(res.id, 'saved')}
                                >
                                  Save To Applications
                                </Button>
                                {res.link ? (
                                  <a
                                    href={res.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900"
                                  >
                                    View Job <ExternalLink size={11} />
                                  </a>
                                ) : null}
                              </div>
                            </Card>
                          ))
                        ) : (
                          <Card className="p-4 border-slate-200 bg-slate-50">
                            <div className="text-sm text-slate-600">
                              No cards to display for this run. Try a broader location/title query.
                            </div>
                          </Card>
                        )}
                      </div>
                    )}

                  </div>
                </motion.div>
              ))}
            </div>

            <div className="shrink-0 p-3 md:p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 z-30 sticky bottom-0 md:bottom-0 bottom-[84px]">
              <div className="max-w-4xl mx-auto space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="text-xs py-1 px-3" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={14} /> Upload CV
                  </Button>
                  <Button
                    variant="outline"
                    className="text-xs py-1 px-3"
                    onClick={() => {
                      setAwaitingLinkedinUrlSessionId(activeSession.id)
                      appendAssistantMessage(activeSession.id, {
                        content: 'Paste your LinkedIn profile URL to start import.',
                      })
                    }}
                  >
                    Import LinkedIn Link
                  </Button>
                  <Button variant="outline" className="text-xs py-1 px-3" onClick={() => setWorkspaceMode('matches')}>
                    View Matches
                  </Button>
                </div>
                <div className="flex gap-2 bg-slate-50 p-1 md:p-1.5 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-900 transition-all">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void handleSend()
                      }
                    }}
                    placeholder={awaitingLinkedinUrlSessionId === activeSession.id ? 'Paste LinkedIn profile URL...' : 'Ask me anything...'}
                    className="flex-1 bg-transparent border-none rounded-xl px-3 md:px-4 py-2 focus:outline-none text-sm text-slate-700"
                  />
                  <Button
                    variant="primary"
                    className="px-4 rounded-xl py-2"
                    onClick={() => void handleSend()}
                    disabled={!inputValue.trim() || isActiveSessionBusy}
                  >
                    <ArrowRight size={20} />
                  </Button>
                </div>
                <p className="text-[10px] text-center text-slate-400 mt-1 md:mt-2 font-medium">
                  {isActiveSessionBusy
                    ? 'Search is active. Use Search view for live execution commentary.'
                    : 'Chat is contextual. Use it for questions and clarifications.'}
                </p>
              </div>
            </div>
          </>
        ) : null}

        {workspaceMode === 'matches' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Matched Results</h2>
                <p className="text-sm text-slate-500">All saved matches across jobs, scholarships, and visa.</p>
              </div>
              <Button variant="outline" onClick={() => setWorkspaceMode(primaryWorkspaceMode)}>
                {primaryWorkspaceMode === 'execution' ? 'Back To Search' : 'Back To Chat'}
              </Button>
            </header>

            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <div className="space-y-3">
                  <div className="font-bold text-slate-900">Jobs ({groupedOpportunities.jobs.length})</div>
                  {groupedOpportunities.jobs.length ? (
                    groupedOpportunities.jobs.slice(0, 12).map((job) => (
                      <div key={job.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50">
                        <div className="text-sm font-semibold text-slate-900">{job.title}</div>
                        <div className="text-xs text-slate-500">{job.organization} • {job.location}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No job matches yet.</div>
                  )}
                </div>
              </Card>

              <Card>
                <div className="space-y-3">
                  <div className="font-bold text-slate-900">Scholarships ({groupedOpportunities.scholarships.length})</div>
                  {groupedOpportunities.scholarships.length ? (
                    groupedOpportunities.scholarships.slice(0, 12).map((row) => (
                      <div key={row.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50">
                        <div className="text-sm font-semibold text-slate-900">{row.title}</div>
                        <div className="text-xs text-slate-500">{row.organization} • {row.location}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No scholarship matches yet.</div>
                  )}
                </div>
              </Card>

              <Card>
                <div className="space-y-3">
                  <div className="font-bold text-slate-900">Visa ({groupedOpportunities.visas.length})</div>
                  {groupedOpportunities.visas.length ? (
                    groupedOpportunities.visas.slice(0, 12).map((row) => (
                      <div key={row.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50">
                        <div className="text-sm font-semibold text-slate-900">{row.title}</div>
                        <div className="text-xs text-slate-500">{row.organization} • {row.location}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No visa matches yet.</div>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <div className="space-y-3">
                  <div className="font-bold text-slate-900">Application Pipeline ({applications.length})</div>
                  {applications.length ? (
                    applications.slice(0, 12).map((app) => (
                      <div key={app.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{app.opportunity?.title || 'Application'}</div>
                          <div className="text-xs text-slate-500">{app.opportunity?.organization || 'Unknown org'}</div>
                        </div>
                        <Badge color="emerald">{app.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No applications yet.</div>
                  )}
                </div>
              </Card>

              <Card>
                <div className="space-y-3">
                  <div className="font-bold text-slate-900">Documents ({documents.length})</div>
                  {documents.length ? (
                    documents.slice(0, 12).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{doc.title}</div>
                          <div className="text-xs text-slate-500">{doc.type.toUpperCase()}</div>
                        </div>
                        <Button variant="ghost" className="text-xs" onClick={() => void onDeleteDocument(doc.id)}>
                          Delete
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No documents yet.</div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : null}

        {workspaceMode === 'settings' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Settings & Profile</h2>
                <p className="text-sm text-slate-500">Account snapshot and preferences used by the chat engine.</p>
              </div>
              <Button variant="outline" onClick={() => setWorkspaceMode(primaryWorkspaceMode)}>
                {primaryWorkspaceMode === 'execution' ? 'Back To Search' : 'Back To Chat'}
              </Button>
            </header>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <div className="space-y-3">
                  <div className="font-bold text-slate-900">Account</div>
                  <div className="text-sm text-slate-600">Email: {authUser?.email || 'Unknown'}</div>
                  <div className="text-sm text-slate-600">User ID: {authUser?.userId || 'Unknown'}</div>
                  <Button variant="danger" onClick={onSignOut}>Sign Out</Button>
                </div>
              </Card>

              <Card>
                <div className="space-y-3">
                  <div className="font-bold text-slate-900">CV & Profile</div>
                  <div className="text-sm text-slate-600">CVs uploaded: {cvs.length}</div>
                  <div className="text-sm text-slate-600">Profiles extracted: {profiles.length}</div>
                  <div className="text-sm text-slate-600">Intent status: {candidateIntent?.status || 'not set'}</div>
                  {cvError ? <div className="text-xs text-rose-600">CV error: {cvError}</div> : null}
                  {linkedinImportError ? <div className="text-xs text-rose-600">LinkedIn error: {linkedinImportError}</div> : null}
                </div>
              </Card>
            </div>

            <Card>
              <div className="space-y-3">
                <div className="font-bold text-slate-900">Intent Snapshot</div>
                <div className="text-sm text-slate-600">Goal: {candidateIntent?.goal || 'not set'}</div>
                <div className="text-sm text-slate-600">Roles: {Array.isArray(candidateIntent?.targetRoles) ? candidateIntent?.targetRoles.join(', ') : 'none'}</div>
                <div className="text-sm text-slate-600">Locations: {Array.isArray(candidateIntent?.targetLocations) ? candidateIntent?.targetLocations.join(', ') : 'none'}</div>
                <div className="text-sm text-slate-600">Work mode: {Array.isArray(candidateIntent?.workModes) ? candidateIntent?.workModes.join(', ') : 'none'}</div>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  )
}
