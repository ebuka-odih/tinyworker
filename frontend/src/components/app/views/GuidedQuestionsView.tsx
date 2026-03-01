import React, { useEffect, useState } from 'react'
import { Briefcase, CheckCircle2, Compass, MapPin, MessageSquare, ShieldAlert, Target, Wallet } from 'lucide-react'

import { CandidateIntent } from '../../../types'
import { Badge, Button, Card } from '../AppPrimitives'

function parseCommaList(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function toCommaList(items: string[] | null | undefined): string {
  return Array.isArray(items) ? items.join(', ') : ''
}

function appendCommaItem(raw: string, item: string): string {
  const values = new Set(parseCommaList(raw).map((entry) => entry.toLowerCase()))
  if (values.has(item.toLowerCase())) return raw
  const clean = parseCommaList(raw)
  clean.push(item)
  return clean.join(', ')
}

const GOAL_OPTIONS: Array<NonNullable<CandidateIntent['goal']>> = ['job', 'scholarship', 'visa', 'mixed']
const WORK_MODE_OPTIONS: Array<'remote' | 'hybrid' | 'onsite'> = ['remote', 'hybrid', 'onsite']
const ROLE_SUGGESTIONS = ['Backend Engineer', 'Data Engineer', 'ML Engineer', 'DevOps Engineer', 'Product Manager']
const LOCATION_SUGGESTIONS = ['Germany', 'Netherlands', 'United Kingdom', 'Canada', 'Remote EU']
const INDUSTRY_SUGGESTIONS = ['FinTech', 'HealthTech', 'EdTech', 'SaaS', 'AI']
const CURRENCY_SUGGESTIONS = ['EUR', 'USD', 'GBP', 'CAD', 'AUD']
const START_TIMELINE_SUGGESTIONS = ['Immediately', 'Within 2 weeks', 'Within 1 month', 'Within 3 months', 'After graduation']
const CONSTRAINT_SUGGESTIONS = [
  'Visa sponsorship required',
  'Remote interviews only',
  'No relocation before June',
  'Mid-level roles only',
  'English-speaking teams',
]
const NOTE_SUGGESTIONS = [
  'Prioritize companies with clear growth paths.',
  'Focus on roles with strong mentorship.',
  'Avoid high-travel positions.',
  'Prefer organizations with international teams.',
  'Optimize for fastest interview cycle.',
]

const SUGGESTION_BTN = 'px-3 py-1.5 rounded-full border bg-white text-slate-700 border-slate-200 hover:border-slate-400 text-xs font-semibold'

export function GuidedQuestionsView({
  intent,
  intentError,
  isSavingIntent,
  hasCv,
  onSaveIntent,
  onGoDashboard,
  onContinueSearch,
}: {
  intent: CandidateIntent | null
  intentError: string | null
  isSavingIntent: boolean
  hasCv: boolean
  onSaveIntent: (payload: Partial<CandidateIntent>) => Promise<void>
  onGoDashboard: () => void
  onContinueSearch: () => void
}) {
  const [goal, setGoal] = useState<CandidateIntent['goal']>('job')
  const [targetRoles, setTargetRoles] = useState('')
  const [targetLocations, setTargetLocations] = useState('')
  const [workModes, setWorkModes] = useState<Array<'remote' | 'hybrid' | 'onsite'>>([])
  const [industries, setIndustries] = useState('')
  const [salaryCurrency, setSalaryCurrency] = useState('EUR')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [startTimeline, setStartTimeline] = useState('')
  const [visaRequired, setVisaRequired] = useState<'unknown' | 'yes' | 'no'>('unknown')
  const [constraints, setConstraints] = useState('')
  const [notes, setNotes] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!intent) return
    setGoal(intent.goal ?? 'job')
    setTargetRoles(toCommaList(intent.targetRoles))
    setTargetLocations(toCommaList(intent.targetLocations))
    setWorkModes(Array.isArray(intent.workModes) ? intent.workModes : [])
    setIndustries(toCommaList(intent.industries))
    setSalaryCurrency(intent.salaryCurrency || 'EUR')
    setSalaryMin(typeof intent.salaryMin === 'number' ? String(intent.salaryMin) : '')
    setSalaryMax(typeof intent.salaryMax === 'number' ? String(intent.salaryMax) : '')
    setStartTimeline(intent.startTimeline || '')
    if (intent.visaRequired === true) setVisaRequired('yes')
    else if (intent.visaRequired === false) setVisaRequired('no')
    else setVisaRequired('unknown')
    setConstraints(toCommaList(intent.constraints))
    setNotes(intent.notes || '')
  }, [intent])

  const toggleWorkMode = (mode: 'remote' | 'hybrid' | 'onsite') => {
    setWorkModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]))
  }

  const setSalaryRange = (min: number, max: number) => {
    setSalaryMin(String(min))
    setSalaryMax(String(max))
  }

  const buildPayload = (): Partial<CandidateIntent> => {
    const parsedMin = salaryMin.trim() ? Number(salaryMin.trim()) : null
    const parsedMax = salaryMax.trim() ? Number(salaryMax.trim()) : null

    return {
      goal,
      targetRoles: parseCommaList(targetRoles),
      targetLocations: parseCommaList(targetLocations),
      workModes,
      industries: parseCommaList(industries),
      salaryCurrency: salaryCurrency.trim() || null,
      salaryMin: Number.isFinite(parsedMin) ? parsedMin : null,
      salaryMax: Number.isFinite(parsedMax) ? parsedMax : null,
      startTimeline: startTimeline.trim() || null,
      visaRequired: visaRequired === 'unknown' ? null : visaRequired === 'yes',
      constraints: parseCommaList(constraints),
      notes: notes.trim() || null,
    }
  }

  const validateCore = (): string | null => {
    const payload = buildPayload()

    if (!goal) return 'Select a goal before continuing.'
    if (parseCommaList(targetRoles).length === 0) return 'Add at least one target role before continuing.'

    if (
      typeof payload.salaryMin === 'number' &&
      typeof payload.salaryMax === 'number' &&
      payload.salaryMax < payload.salaryMin
    ) {
      return 'Maximum salary must be greater than or equal to minimum salary.'
    }

    return null
  }

  const saveIntent = async (status: 'draft' | 'ready') => {
    const validationError = validateCore()
    if (validationError && status === 'ready') {
      setLocalError(validationError)
      setSaveMessage(null)
      return false
    }

    setLocalError(null)
    setSaveMessage(null)

    try {
      await onSaveIntent({ ...buildPayload(), status })
      setSaveMessage(status === 'ready' ? 'Saved. Starting live search execution...' : 'Progress saved.')
      return true
    } catch (e: any) {
      setLocalError(e?.message || 'Failed to save guided profile')
      return false
    }
  }

  const missingItems = [
    parseCommaList(targetRoles).length === 0 ? 'Target role' : null,
    parseCommaList(targetLocations).length === 0 ? 'Preferred location' : null,
    hasCv ? null : 'CV upload',
  ].filter(Boolean) as string[]

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Agent Workspace</h2>
          <p className="text-sm text-slate-500">Set your intent once, then continue search with clear context.</p>
        </div>
        <Button variant="outline" onClick={onGoDashboard}>
          Back to Dashboard
        </Button>
      </header>

      {localError || intentError ? (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{localError || intentError}</div>
      ) : null}
      {saveMessage ? (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{saveMessage}</div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white" id="goal">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Target size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">What should I optimize for?</p>
                  <p className="text-sm text-slate-500">Choose one primary outcome for this search cycle.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {GOAL_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setGoal(option)}
                    className={`p-3 rounded-xl border text-sm font-semibold capitalize transition-colors ${
                      goal === option
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white" id="focus">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Compass size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Role and location preferences</p>
                  <p className="text-sm text-slate-500">This is where you set your role. Add at least one target role.</p>
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Target Roles (comma-separated)</span>
                <input
                  type="text"
                  value={targetRoles}
                  onChange={(e) => setTargetRoles(e.target.value)}
                  className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="Backend Engineer, Data Engineer"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {ROLE_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTargetRoles((prev) => appendCommaItem(prev, item))}
                      className={SUGGESTION_BTN}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Target Locations (comma-separated)</span>
                <input
                  type="text"
                  value={targetLocations}
                  onChange={(e) => setTargetLocations(e.target.value)}
                  className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="Berlin, Remote"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {LOCATION_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTargetLocations((prev) => appendCommaItem(prev, item))}
                      className={SUGGESTION_BTN}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white" id="preferences">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <Wallet size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Working preferences</p>
                  <p className="text-sm text-slate-500">Optional, but improves quality of matching and ranking.</p>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2">Work Modes</div>
                <div className="flex flex-wrap gap-2">
                  {WORK_MODE_OPTIONS.map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => toggleWorkMode(mode)}
                      className={`px-3 py-2 rounded-xl border text-sm font-semibold capitalize ${
                        workModes.includes(mode)
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <label>
                  <span className="text-xs font-semibold text-slate-600">Salary Currency</span>
                  <input
                    type="text"
                    value={salaryCurrency}
                    onChange={(e) => setSalaryCurrency(e.target.value.toUpperCase())}
                    className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="EUR"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CURRENCY_SUGGESTIONS.map((currency) => (
                      <button
                        key={currency}
                        type="button"
                        onClick={() => setSalaryCurrency(currency)}
                        className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                          salaryCurrency === currency
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {currency}
                      </button>
                    ))}
                  </div>
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-600">Min Salary</span>
                  <input
                    type="number"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="70000"
                  />
                </label>
                <label>
                  <span className="text-xs font-semibold text-slate-600">Max Salary</span>
                  <input
                    type="number"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="110000"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Salary range presets</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { label: '€40k–€60k', min: 40000, max: 60000 },
                    { label: '€60k–€80k', min: 60000, max: 80000 },
                    { label: '€80k–€100k', min: 80000, max: 100000 },
                    { label: '€100k–€130k', min: 100000, max: 130000 },
                    { label: '€130k+', min: 130000, max: 180000 },
                  ].map((range) => (
                    <button
                      key={range.label}
                      type="button"
                      onClick={() => setSalaryRange(range.min, range.max)}
                      className={SUGGESTION_BTN}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Start Timeline</span>
                <input
                  type="text"
                  value={startTimeline}
                  onChange={(e) => setStartTimeline(e.target.value)}
                  className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="Immediate, within 1 month, after graduation"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {START_TIMELINE_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setStartTimeline(item)}
                      className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                        startTimeline === item
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Industries (comma-separated)</span>
                <input
                  type="text"
                  value={industries}
                  onChange={(e) => setIndustries(e.target.value)}
                  className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="FinTech, HealthTech"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {INDUSTRY_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setIndustries((prev) => appendCommaItem(prev, item))}
                      className={SUGGESTION_BTN}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white" id="constraints">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Constraints and notes</p>
                  <p className="text-sm text-slate-500">Add hard constraints and any additional instructions for the agent.</p>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2">Visa Sponsorship Required?</div>
                <div className="flex gap-2">
                  {[
                    { key: 'unknown', label: 'Unknown' },
                    { key: 'yes', label: 'Yes' },
                    { key: 'no', label: 'No' },
                  ].map((choice) => (
                    <button
                      key={choice.key}
                      type="button"
                      onClick={() => setVisaRequired(choice.key as 'unknown' | 'yes' | 'no')}
                      className={`px-3 py-2 rounded-xl border text-sm font-semibold ${
                        visaRequired === choice.key
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Hard Constraints (comma-separated)</span>
                <input
                  type="text"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="No relocation before June, only remote interviews"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {CONSTRAINT_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setConstraints((prev) => appendCommaItem(prev, item))}
                      className={SUGGESTION_BTN}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Extra Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full p-3 min-h-[120px] bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="Anything the matching/ranking flow should consider"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {NOTE_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setNotes(item)}
                      className={SUGGESTION_BTN}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" disabled={isSavingIntent} onClick={() => saveIntent('draft')}>
              {isSavingIntent ? 'Saving...' : 'Save Progress'}
            </Button>
            <Button disabled={isSavingIntent} onClick={async () => {
              const ok = await saveIntent('ready')
              if (ok) onContinueSearch()
            }}>
              {isSavingIntent ? 'Saving...' : 'Save and Continue Search'}
            </Button>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card className="border-slate-200 bg-white">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900">What I Know About You</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="inline-flex items-center gap-2 text-slate-500"><Target size={14} /> Goal</div>
                  <div className="font-medium text-slate-800 text-right capitalize">{goal || 'Not set'}</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="inline-flex items-center gap-2 text-slate-500"><Briefcase size={14} /> Role</div>
                  <div className="font-medium text-slate-800 text-right">{parseCommaList(targetRoles).join(', ') || 'Not set'}</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="inline-flex items-center gap-2 text-slate-500"><MapPin size={14} /> Location</div>
                  <div className="font-medium text-slate-800 text-right">{parseCommaList(targetLocations).join(', ') || 'Not set'}</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="inline-flex items-center gap-2 text-slate-500"><Compass size={14} /> Industry</div>
                  <div className="font-medium text-slate-800 text-right">{parseCommaList(industries).join(', ') || 'Not set'}</div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="inline-flex items-center gap-2 text-slate-500"><CheckCircle2 size={14} /> CV status</div>
                  <div className="font-medium text-slate-800 text-right">{hasCv ? 'On file' : 'Not uploaded'}</div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing before continue</div>
              {missingItems.length ? (
                <div className="flex flex-wrap gap-2">
                  {missingItems.map((item) => (
                    <Badge key={item} color="rose">
                      {item}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-emerald-700">All required context is set.</div>
              )}
            </div>
          </Card>

          <Card className="border-slate-200 bg-white">
            <div className="flex items-start gap-2">
              <MessageSquare size={16} className="text-slate-500 mt-0.5" />
              <p className="text-xs text-slate-600">
                Values above update as you type. Click <span className="font-semibold">Save and Continue Search</span> to enter live search execution.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
