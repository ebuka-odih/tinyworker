import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Compass, ShieldAlert, Target, Wallet } from 'lucide-react'

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

const GOAL_OPTIONS: Array<NonNullable<CandidateIntent['goal']>> = ['job', 'scholarship', 'visa', 'mixed']
const WORK_MODE_OPTIONS: Array<'remote' | 'hybrid' | 'onsite'> = ['remote', 'hybrid', 'onsite']

export function GuidedQuestionsView({
  intent,
  intentError,
  isSavingIntent,
  onSaveIntent,
  onGoDashboard,
}: {
  intent: CandidateIntent | null
  intentError: string | null
  isSavingIntent: boolean
  onSaveIntent: (payload: Partial<CandidateIntent>) => Promise<void>
  onGoDashboard: () => void
}) {
  const steps = useMemo(
    () => [
      { key: 'goal', title: 'Define Goal', icon: Target, description: 'Choose your main outcome for this search cycle.' },
      { key: 'focus', title: 'Role Focus', icon: Compass, description: 'Set role and location preferences used in matching.' },
      { key: 'preferences', title: 'Preferences', icon: Wallet, description: 'Capture work mode, compensation, and timeline.' },
      { key: 'constraints', title: 'Constraints', icon: ShieldAlert, description: 'Set hard constraints and extra notes.' },
    ],
    [],
  )

  const [currentStep, setCurrentStep] = useState(0)
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
  }, [intent?.id])

  const toggleWorkMode = (mode: 'remote' | 'hybrid' | 'onsite') => {
    setWorkModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]))
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

  const validateStep = (): string | null => {
    if (currentStep === 0 && !goal) return 'Select a goal to continue.'
    if (currentStep === 1 && parseCommaList(targetRoles).length === 0) {
      return 'Add at least one target role to continue.'
    }

    const payload = buildPayload()
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
    const validationError = validateStep()
    if (validationError && status === 'ready') {
      setLocalError(validationError)
      return false
    }

    setLocalError(null)
    setSaveMessage(null)

    try {
      await onSaveIntent({ ...buildPayload(), status })
      setSaveMessage(status === 'ready' ? 'Guided profile marked ready.' : 'Draft saved.')
      return true
    } catch (e: any) {
      setLocalError(e?.message || 'Failed to save guided profile')
      return false
    }
  }

  const onNext = async () => {
    const validationError = validateStep()
    if (validationError) {
      setLocalError(validationError)
      return
    }

    const ok = await saveIntent('draft')
    if (!ok) return
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1))
  }

  const isLastStep = currentStep === steps.length - 1
  const current = steps[currentStep]

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Guided Questions</h2>
          <p className="text-sm text-slate-500">Phase 2 wizard for capturing candidate intent.</p>
        </div>
        <Button variant="outline" onClick={onGoDashboard}>
          Back to Dashboard
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const isActive = idx === currentStep
          const isDone = idx < currentStep
          return (
            <Card key={step.key} className={`${isActive ? 'border-slate-900' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    isDone ? 'bg-emerald-100 text-emerald-700' : isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isDone ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Step {idx + 1}</div>
                  <div className="text-sm font-semibold text-slate-800">{step.title}</div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Card>
        <div className="space-y-5">
          <div>
            <h3 className="font-bold text-slate-900">{current.title}</h3>
            <p className="text-sm text-slate-500">{current.description}</p>
          </div>

          {currentStep === 0 ? (
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
          ) : null}

          {currentStep === 1 ? (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Target Roles (comma-separated)</span>
                <input
                  type="text"
                  value={targetRoles}
                  onChange={(e) => setTargetRoles(e.target.value)}
                  className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="Backend Engineer, Data Engineer"
                />
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
              </label>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-4">
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

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Start Timeline</span>
                <input
                  type="text"
                  value={startTimeline}
                  onChange={(e) => setStartTimeline(e.target.value)}
                  className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="Immediate, within 1 month, after graduation"
                />
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
              </label>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-4">
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
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Extra Notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full p-3 min-h-[120px] bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  placeholder="Anything the matching/ranking flow should consider"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <Badge color="slate">Goal: {goal || 'unset'}</Badge>
                <Badge color="slate">Roles: {parseCommaList(targetRoles).length}</Badge>
                <Badge color="slate">Locations: {parseCommaList(targetLocations).length}</Badge>
                <Badge color="slate">Modes: {workModes.length}</Badge>
                <Badge color="slate">Status: {intent?.status || 'draft'}</Badge>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {localError || intentError ? (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{localError || intentError}</div>
      ) : null}
      {saveMessage ? (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">{saveMessage}</div>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">Step {currentStep + 1} of {steps.length}</div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={currentStep === 0 || isSavingIntent}
            onClick={() => setCurrentStep((s) => Math.max(s - 1, 0))}
          >
            Previous
          </Button>
          <Button variant="outline" disabled={isSavingIntent} onClick={() => saveIntent('draft')}>
            {isSavingIntent ? 'Saving...' : 'Save Draft'}
          </Button>
          {!isLastStep ? (
            <Button disabled={isSavingIntent} onClick={onNext}>
              Next
            </Button>
          ) : (
            <Button disabled={isSavingIntent} onClick={() => saveIntent('ready')}>
              {isSavingIntent ? 'Saving...' : 'Mark Ready'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
