import React, { useEffect, useState } from 'react'
import { ArrowRight, Search, Settings, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'

import { Opportunity } from '../../../types'
import { tinyfishService } from '../../../services/tinyfishService'
import { Badge, Button, Card } from '../AppPrimitives'

type FlowDomain = 'jobs' | 'scholarships'

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

type OptionContext =
  | { type: 'root' }
  | { type: 'flow'; flow: FlowState }

type LocalChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'text' | 'options' | 'results' | 'progress'
  options?: string[]
  results?: Opportunity[]
  optionContext?: OptionContext
}

const ROOT_OPTIONS = ['Scholarships', 'Jobs', 'Visa Requirements', 'Upload CV']
const REVIEW_OPTIONS = ['Run search', 'Edit', 'Save & monitor']

const JOB_STEPS: FlowStep[] = [
  {
    key: 'job_level',
    prompt: 'What role level are you targeting?',
    options: ['Internship', 'Entry', 'Mid-level', 'Senior'],
  },
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
  {
    key: 'job_mode',
    prompt: 'Preferred work mode?',
    options: ['Remote', 'Hybrid', 'Onsite'],
  },
  {
    key: 'job_source',
    prompt: 'Preferred source(s)?',
    options: [
      'LinkedIn Jobs',
      'Indeed',
      'Jobberman',
      'MyJobMag',
      'Djinni',
      'Company Career Pages',
      'All + Other Trusted Sites',
    ],
  },
  {
    key: 'job_stack',
    prompt: 'Skills/tools to prioritize? Choose, skip, or type manually.',
    options: ['Excel', 'CRM', 'Canva', 'Python', 'Laravel', 'Skip', 'Type manually'],
    manualTextAccepted: true,
    manualPrompt: 'Type skills/tools (comma-separated).',
  },
  {
    key: 'job_visa',
    prompt: 'Need visa sponsorship?',
    options: ['Yes', 'No', 'Skip'],
  },
  {
    key: 'job_salary',
    prompt: 'Salary band?',
    options: [
      'Under N300k/month',
      'N300k - N700k/month',
      'N700k - N1.5m/month',
      'Above N1.5m/month',
      'Skip',
      'Type manually',
    ],
    manualTextAccepted: true,
    manualPrompt: 'Type your salary preference.',
  },
  {
    key: 'job_company',
    prompt: 'Company type?',
    options: ['Startup', 'Enterprise', 'Any'],
  },
  {
    key: 'review',
    prompt: 'Review your job criteria before running search.',
    options: REVIEW_OPTIONS,
  },
]

const SCHOLARSHIP_STEPS: FlowStep[] = [
  {
    key: 'sch_level',
    prompt: 'What are you looking for?',
    options: ["Master's", 'PhD', 'Short course', 'Exchange'],
  },
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
  {
    key: 'sch_funding',
    prompt: 'Funding level?',
    options: ['Full', 'Partial', 'Any'],
  },
  {
    key: 'sch_tuition',
    prompt: 'Tuition preference?',
    options: ['Full tuition', 'Half tuition', 'Any'],
  },
  {
    key: 'sch_intake',
    prompt: 'Preferred intake season?',
    options: ['Summer', 'Winter', 'Any'],
  },
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
  {
    key: 'review',
    prompt: 'Review your scholarship criteria before running search.',
    options: REVIEW_OPTIONS,
  },
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

export function ChatView({
  onImportOpportunities,
  onViewDetails,
}: {
  onImportOpportunities: (items: Opportunity[]) => Promise<void>
  onViewDetails: () => void
}) {
  const [messages, setMessages] = useState<LocalChatMessage[]>([
    {
      id: 'm-0',
      role: 'assistant',
      content:
        "Hi! I'm your Opportunity Agent. I can help you find scholarships, jobs, or visa requirements. What's our goal today?",
      type: 'options',
      options: ROOT_OPTIONS,
      optionContext: { type: 'root' },
    },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [flow, setFlow] = useState<FlowState | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const nextMessageIdRef = React.useRef(1)

  const nextMessageId = () => {
    const id = `m-${nextMessageIdRef.current}`
    nextMessageIdRef.current += 1
    return id
  }

  const appendAssistantMessage = (
    message: Omit<LocalChatMessage, 'id' | 'role' | 'optionContext'>,
    optionContext?: OptionContext,
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: nextMessageId(),
        role: 'assistant',
        ...message,
        optionContext,
      },
    ])
  }

  const appendUserMessage = (content: string) => {
    setMessages((prev) => [...prev, { id: nextMessageId(), role: 'user', content }])
  }

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const askCurrentStep = (nextFlow: FlowState) => {
    const flowSnapshot = cloneFlowState(nextFlow)
    const step = stepsForDomain(nextFlow.domain)[nextFlow.stepIndex]
    if (step.key === 'review') {
      appendAssistantMessage(
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
      {
        content: withStepLabel(nextFlow.domain, nextFlow.stepIndex, step.prompt),
        type: 'options',
        options: step.options,
      },
      { type: 'flow', flow: flowSnapshot },
    )
  }

  const restartFlow = (domain: FlowDomain) => {
    const nextFlow: FlowState = { domain, stepIndex: 0, criteria: {} }
    setFlow(cloneFlowState(nextFlow))
    askCurrentStep(nextFlow)
  }

  const runJobSearch = async (criteria: Record<string, string>) => {
    setIsTyping(true)
    appendAssistantMessage({
      content: 'Running jobs search with your criteria and scanning live listings...',
      type: 'progress',
    })

    try {
      const title = criteria.job_title && normalizeText(criteria.job_title) !== 'skip' ? criteria.job_title : 'Software Engineer'
      const focus = criteria.job_focus && normalizeText(criteria.job_focus) !== 'any' ? criteria.job_focus : ''
      const location = criteria.job_location && normalizeText(criteria.job_location) !== 'global' ? criteria.job_location : 'Remote'
      const visaHint = normalizeText(criteria.job_visa || '') === 'yes' ? 'visa sponsorship' : ''
      const query = [title, focus, location, visaHint].filter(Boolean).join(' ').trim()

      const results = await tinyfishService.searchJobsLinkedIn(query)
      await onImportOpportunities(results)

      appendAssistantMessage({
        content: 'Search complete. Here are roles I found:',
        type: 'results',
        results,
      })
      appendAssistantMessage(
        {
          content: 'You can start a new search or open dashboard details.',
          type: 'options',
          options: ['New Jobs Search', 'Go to Dashboard'],
        },
        { type: 'root' },
      )
    } catch (e: any) {
      appendAssistantMessage({
        content: e?.message || 'Job search failed. Please try again.',
      })
      appendAssistantMessage(
        {
          content: 'Choose next action.',
          type: 'options',
          options: ['Retry Jobs Search', 'Go to Dashboard'],
        },
        { type: 'root' },
      )
    } finally {
      setFlow(null)
      setIsTyping(false)
    }
  }

  const runScholarshipSearch = async () => {
    appendAssistantMessage({
      content:
        'Scholarship live search integration is next. Your scholarship criteria has been captured and is ready for backend execution.',
    })
    appendAssistantMessage(
      {
        content: 'Choose next action.',
        type: 'options',
        options: ['New Scholarships Search', 'Go to Dashboard'],
      },
      { type: 'root' },
    )
    setFlow(null)
  }

  const handleRootInput = async (value: string) => {
    const normalized = normalizeText(value)
    if (
      normalized === normalizeText('Jobs') ||
      normalized === normalizeText('New Jobs Search') ||
      normalized === normalizeText('Retry Jobs Search')
    ) {
      restartFlow('jobs')
      return
    }

    if (normalized === normalizeText('Scholarships') || normalized === normalizeText('New Scholarships Search')) {
      restartFlow('scholarships')
      return
    }

    if (normalized === normalizeText('Go to Dashboard')) {
      onViewDetails()
      return
    }

    if (normalized === normalizeText('Visa Requirements')) {
      appendAssistantMessage(
        {
          content: 'Visa flow in web chat is not yet wired. For now, use Jobs or Scholarships flow.',
          type: 'options',
          options: ROOT_OPTIONS,
        },
        { type: 'root' },
      )
      return
    }

    if (normalized === normalizeText('Upload CV')) {
      appendAssistantMessage(
        {
          content: 'Use Dashboard -> Upload CV, then return here for guided matching.',
          type: 'options',
          options: ['Go to Dashboard', 'Jobs', 'Scholarships'],
        },
        { type: 'root' },
      )
      return
    }

    appendAssistantMessage(
      {
        content: 'Pick a flow to continue.',
        type: 'options',
        options: ROOT_OPTIONS,
      },
      { type: 'root' },
    )
  }

  const handleFlowInput = async (value: string, sourceFlow: FlowState) => {
    const activeFlow = cloneFlowState(sourceFlow)
    setFlow(activeFlow)

    const steps = stepsForDomain(activeFlow.domain)
    const step = steps[activeFlow.stepIndex]
    const normalized = normalizeText(value)

    if (step.key === 'review') {
      if (normalized === normalizeText('Run search')) {
        if (activeFlow.domain === 'jobs') {
          await runJobSearch(activeFlow.criteria)
        } else {
          await runScholarshipSearch()
        }
        return
      }

      if (normalized === normalizeText('Edit')) {
        restartFlow(activeFlow.domain)
        return
      }

      if (normalized === normalizeText('Save & monitor')) {
        appendAssistantMessage(
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
      appendAssistantMessage({
        content: step.manualPrompt || 'Type your answer in the input below.',
      })
      return
    }

    if (!matched && !step.manualTextAccepted) {
      appendAssistantMessage(
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
      setFlow(null)
      appendAssistantMessage(
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

    setFlow(cloneFlowState(nextFlow))
    askCurrentStep(nextFlow)
  }

  const handleUserInput = async (value: string, context?: OptionContext) => {
    const trimmed = value.trim()
    if (!trimmed || isTyping) return

    appendUserMessage(trimmed)

    if (context?.type === 'flow') {
      await handleFlowInput(trimmed, context.flow)
      return
    }

    if (context?.type === 'root') {
      await handleRootInput(trimmed)
      return
    }

    if (!flow) {
      await handleRootInput(trimmed)
      return
    }

    await handleFlowInput(trimmed, flow)
  }

  const handleOption = async (option: string, sourceMessageId: string) => {
    const source = messages.find((msg) => msg.id === sourceMessageId)
    await handleUserInput(option, source?.optionContext)
  }

  const handleSend = async () => {
    if (!inputValue.trim()) return
    const value = inputValue
    setInputValue('')
    await handleUserInput(value)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-lg shadow-slate-200">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Opportunity Agent</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent View</span>
              <span className="text-[10px] text-slate-400">• Guided steps + results</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <Search size={18} />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-[180px] md:pb-44 scroll-smooth">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-[85%] space-y-3">
              <div
                className={`p-4 rounded-2xl shadow-sm leading-relaxed text-sm whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-br-none font-medium'
                    : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                }`}
              >
                {msg.content}
              </div>

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
                  {msg.results?.map((res) => (
                    <Card key={res.id} className="p-4 border-slate-200 hover:border-slate-400 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <Badge color="slate">{res.type.toUpperCase()}</Badge>
                        {res.matchScore && (
                          <span className="text-[10px] font-bold text-slate-900">{res.matchScore}% Match</span>
                        )}
                      </div>
                      <div className="font-bold text-slate-900 group-hover:text-slate-600 transition-colors">{res.title}</div>
                      <div className="text-xs text-slate-500 mb-2">{res.organization} • {res.location}</div>
                      <div className="text-[11px] text-slate-600 line-clamp-2 mb-3 leading-relaxed">{res.description}</div>
                      <Button
                        variant="ghost"
                        className="w-full text-[10px] py-1 bg-slate-50 hover:bg-slate-100"
                        onClick={onViewDetails}
                      >
                        View Details
                      </Button>
                    </Card>
                  ))}
                </div>
              )}

              {msg.type === 'progress' && (
                <div className="flex items-center gap-3 p-3 bg-slate-100/50 rounded-xl border border-slate-200/50 text-xs text-slate-700 font-medium">
                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  {msg.content}
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm flex gap-1 border border-slate-100">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 p-3 md:p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 z-30 sticky bottom-0 md:bottom-0 bottom-[84px]">
        <div className="max-w-3xl mx-auto flex gap-2 bg-slate-50 p-1 md:p-1.5 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-900 transition-all">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleSend()
              }
            }}
            placeholder="Ask me anything..."
            className="flex-1 bg-transparent border-none rounded-xl px-3 md:px-4 py-2 focus:outline-none text-sm text-slate-700"
          />
          <Button
            variant="primary"
            className="px-4 rounded-xl py-2"
            onClick={() => void handleSend()}
            disabled={!inputValue.trim() || isTyping}
          >
            <ArrowRight size={20} />
          </Button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-1 md:mt-2 font-medium">Click options above or type to continue</p>
      </div>
    </div>
  )
}
