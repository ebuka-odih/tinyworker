import React, { useEffect, useMemo, useState } from 'react'
import { Loader2, Linkedin, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react'

import { LinkedinImportJob } from '../../../types'
import { Badge, Button, Card } from '../AppPrimitives'

export function BuildResumeView({
  isStarting,
  job,
  error,
  onStart,
  onRefresh,
  onBackDashboard,
  onOpenProfileReview,
}: {
  isStarting: boolean
  job: LinkedinImportJob | null
  error: string | null
  onStart: (linkedinUrl: string) => Promise<void>
  onRefresh: (jobId: string) => Promise<void>
  onBackDashboard: () => void
  onOpenProfileReview: () => void
}) {
  const [linkedinUrl, setLinkedinUrl] = useState('')

  useEffect(() => {
    if (job?.linkedinUrl) setLinkedinUrl(job.linkedinUrl)
  }, [job?.id, job?.linkedinUrl])

  useEffect(() => {
    if (!job) return
    if (job.status !== 'queued' && job.status !== 'running') return
    void onRefresh(job.id)
    const t = setInterval(() => {
      void onRefresh(job.id)
    }, 2500)
    return () => clearInterval(t)
  }, [job?.id, job?.status, onRefresh])

  const statusLabel = useMemo(() => {
    if (!job) return 'idle'
    if (job.status === 'queued') return 'queued'
    if (job.status === 'running') return 'building'
    if (job.status === 'succeeded') return 'completed'
    return 'failed'
  }, [job])

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Build Resume</h2>
          <p className="text-sm text-slate-500">Generate a resume and profile from your LinkedIn URL.</p>
        </div>
        <Button variant="outline" onClick={onBackDashboard} icon={ArrowLeft}>
          Dashboard
        </Button>
      </header>

      <Card>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            const value = linkedinUrl.trim()
            if (!value) return
            await onStart(value)
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">LinkedIn Profile URL</span>
            <div className="mt-1 flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/your-profile"
                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none text-sm"
              />
              <Button type="submit" disabled={isStarting || !linkedinUrl.trim()} icon={Linkedin}>
                {isStarting ? 'Starting...' : 'Build Resume'}
              </Button>
            </div>
          </label>
        </form>
      </Card>

      {error ? (
        <Card className="border-rose-200 bg-rose-50">
          <div className="text-sm text-rose-700">{error}</div>
        </Card>
      ) : null}

      {job ? (
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Status</div>
                <div className="text-slate-900 font-semibold capitalize">{statusLabel}</div>
              </div>
              <Badge color={job.status === 'succeeded' ? 'emerald' : job.status === 'failed' ? 'rose' : 'slate'}>
                {statusLabel}
              </Badge>
            </div>

            {(job.status === 'queued' || job.status === 'running') && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 size={16} className="animate-spin" />
                <span>{job.stage || 'working'}</span>
              </div>
            )}

            {job.status === 'succeeded' && (
              <div className="flex items-center gap-2 text-emerald-700 text-sm">
                <CheckCircle2 size={16} />
                <span>Resume build completed. You can review your profile now.</span>
              </div>
            )}

            {job.status === 'failed' && (
              <div className="flex items-start gap-2 text-rose-700 text-sm">
                <AlertTriangle size={16} className="mt-0.5" />
                <span>{job.error || 'Resume build failed'}</span>
              </div>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {job.logs.map((entry, idx) => (
                <div key={`${entry.at}-${idx}`} className="text-xs text-slate-600 p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-mono text-slate-400 mr-2">{new Date(entry.at).toLocaleTimeString()}</span>
                  <span>{entry.message}</span>
                </div>
              ))}
            </div>

            {job.status === 'succeeded' && (
              <div className="pt-2">
                <Button onClick={onOpenProfileReview}>Open Profile Review</Button>
              </div>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
