import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FileText,
  Linkedin,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react'
import { motion } from 'motion/react'

import { Application, AuthUser, CVData, CandidateIntent, CandidateProfile, Document, Opportunity } from '../../../types'
import { Badge, Button, Card, Modal } from '../AppPrimitives'

export function DashboardView({
  authUser,
  candidateIntent,
  cvs,
  opportunities,
  applications,
  profiles,
  isLoading,
  isExtractingProfile,
  cvError,
  profileError,
  onUploadCv,
  onOpenBuildResume,
  onExtractProfile,
  onOpenGuidedQuestions,
  onContinueSearch,
  onCreateApplication,
  onCreateDocument,
  onNavigateProfileReview,
}: {
  authUser: AuthUser | null
  candidateIntent: CandidateIntent | null
  cvs: CVData[]
  opportunities: Opportunity[]
  applications: Application[]
  profiles: CandidateProfile[]
  isLoading: boolean
  isExtractingProfile: boolean
  cvError: string | null
  profileError: string | null
  onUploadCv: (file: File) => Promise<void>
  onOpenBuildResume: () => void
  onExtractProfile: (cvId: string) => Promise<void>
  onOpenGuidedQuestions: () => void
  onContinueSearch: () => void
  onCreateApplication: (opportunityId: string, status?: Application['status']) => Promise<void>
  onCreateDocument: (doc: Pick<Document, 'type' | 'title' | 'content' | 'opportunityId'>) => Promise<void>
  onNavigateProfileReview: () => void
}) {
  const [isRevampModalOpen, setIsRevampModalOpen] = useState(false)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [targetRole, setTargetRole] = useState('')
  const [targetTone, setTargetTone] = useState('Professional')
  const [isRevamping, setIsRevamping] = useState(false)
  const [revampResult, setRevampResult] = useState<string | null>(null)
  const [isSearchPaused, setIsSearchPaused] = useState(false)
  const [activeActivityIndex, setActiveActivityIndex] = useState(0)
  const latestProfile = profiles[0]
  const cvFileInputRef = React.useRef<HTMLInputElement>(null)

  const primaryRole = candidateIntent?.targetRoles?.[0] || latestProfile?.titleHeadline || 'Backend Engineer'
  const primaryLocation = candidateIntent?.targetLocations?.[0] || 'Germany'

  const focusTags = useMemo(() => {
    const tags = new Set<string>()
    for (const mode of candidateIntent?.workModes || []) tags.add(mode)
    for (const industry of candidateIntent?.industries || []) tags.add(industry)
    for (const constraint of candidateIntent?.constraints || []) tags.add(constraint)
    if (candidateIntent?.visaRequired) tags.add('visa-friendly')
    if (tags.size === 0) {
      tags.add('backend')
      tags.add('visa-friendly')
      tags.add('growth-stage')
    }
    return Array.from(tags).slice(0, 4)
  }, [candidateIntent?.constraints, candidateIntent?.industries, candidateIntent?.visaRequired, candidateIntent?.workModes])

  const activityItems = useMemo(
    () => [
      `Scanning ${primaryRole.toLowerCase()} roles in ${primaryLocation}`,
      'Comparing your CV against role requirements',
      candidateIntent?.visaRequired ? 'Tracking visa-friendly companies and sponsors' : 'Tracking best-fit companies',
      'Refreshing your shortlist as new postings appear',
    ],
    [candidateIntent?.visaRequired, primaryLocation, primaryRole],
  )

  useEffect(() => {
    if (isSearchPaused) return
    const timer = window.setInterval(() => {
      setActiveActivityIndex((current) => (current + 1) % activityItems.length)
    }, 2600)

    return () => window.clearInterval(timer)
  }, [activityItems.length, isSearchPaused])

  const fitLabel = (matchScore?: number) => {
    if (typeof matchScore !== 'number') return 'Potential fit'
    if (matchScore >= 80) return 'Strong fit'
    if (matchScore >= 60) return 'Good fit'
    return 'Possible fit'
  }

  const handleRevamp = async () => {
    if (!targetRole) return
    setIsRevamping(true)
    try {
      setRevampResult(
        `(Coming soon) Resume revamp for: ${targetRole} (${targetTone})\n\nWe will rewrite your CV to match selected jobs using extracted keywords.`,
      )
    } catch (error) {
      console.error('Revamp failed:', error)
    } finally {
      setIsRevamping(false)
    }
  }

  const saveRevampedCV = async () => {
    if (!revampResult) return
    await onCreateDocument({
      type: 'cv',
      title: `Revamped CV - ${targetRole}`,
      content: revampResult,
    })
    setRevampResult(null)
    setIsRevampModalOpen(false)
    setTargetRole('')
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Opportunity Agent</h2>
          <p className="text-sm text-slate-500">Welcome back, {authUser?.email?.split('@')[0] || 'there'}. Your search runs here.</p>
        </div>
      </header>

      <Card className="bg-white border-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-1">Your Current Goal</div>
            <div className="text-lg font-bold text-slate-900">{primaryRole}</div>
            <div className="text-sm text-slate-500">{primaryLocation}</div>
          </div>
          <Badge color={isSearchPaused ? 'amber' : 'emerald'}>{isSearchPaused ? 'Paused' : 'Active'}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {focusTags.map((tag) => (
            <Badge key={tag} color="slate">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" icon={Edit3} onClick={onOpenGuidedQuestions}>
            Refine goal
          </Button>
          <Button variant="ghost" icon={isSearchPaused ? PlayCircle : PauseCircle} onClick={() => setIsSearchPaused((v) => !v)}>
            {isSearchPaused ? 'Resume search' : 'Pause search'}
          </Button>
        </div>
      </Card>

      <Card className="bg-white border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center">
            <Activity size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">Agent activity</div>
            <div className="text-xs text-slate-500">Live search operations</div>
          </div>
        </div>
        <div className="space-y-2.5">
          {activityItems.map((item, index) => {
            const isActive = !isSearchPaused && index === activeActivityIndex
            return (
              <div
                key={item}
                className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
                  isActive ? 'border-slate-300 bg-slate-50' : 'border-slate-100 bg-white'
                }`}
              >
                <motion.span
                  animate={isActive ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.5 }}
                  transition={isActive ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 }}
                  className={`mt-1.5 h-2 w-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                />
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="bg-white border-slate-200">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-base font-semibold text-slate-900">Continue with your current search intent</div>
              <div className="text-sm text-slate-500">Keep the agent focused while you adjust supporting inputs only when needed.</div>
            </div>
            <Button onClick={onContinueSearch} icon={Search} className="md:min-w-[180px]">
              Continue Search
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <button
              type="button"
              onClick={() => cvFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Upload size={14} />
              <span>{isLoading ? 'Uploading…' : 'Upload CV'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenBuildResume}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Linkedin size={14} />
              <span>Import LinkedIn</span>
            </button>
            <button
              type="button"
              onClick={onOpenGuidedQuestions}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Edit3 size={14} />
              <span>Adjust preferences</span>
            </button>
          </div>
        </div>
        <input
          ref={cvFileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onUploadCv(f)
            e.currentTarget.value = ''
          }}
        />
      </Card>

      {cvError ? (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{cvError}</div>
      ) : null}
      {profileError ? (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{profileError}</div>
      ) : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">CV & Profile</h3>
          <button className="text-slate-900 text-xs font-bold hover:underline">Manage</button>
        </div>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
              <FileText size={24} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-800 truncate max-w-[220px] sm:max-w-[420px]">
                {cvs[0]?.name || 'No CV uploaded yet'}
              </div>
              <div className="text-xs text-slate-500 truncate max-w-[220px] sm:max-w-[420px]">
                {cvs[0]?.createdAt
                  ? `Uploaded ${new Date(cvs[0].createdAt).toLocaleString()}`
                  : 'Upload a PDF or DOCX to begin'}
              </div>
            </div>
            <Badge color={cvs.length ? 'emerald' : 'slate'}>{cvs.length ? 'On file' : 'Missing'}</Badge>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
            <Button
              variant="primary"
              className="flex-1 text-xs py-2 shadow-lg shadow-slate-200"
              icon={Search}
              disabled={!cvs.length || isLoading}
              onClick={() => {
                if (!latestProfile) {
                  onExtractProfile(cvs[0].id)
                  return
                }
                onNavigateProfileReview()
              }}
            >
              {!cvs.length
                ? 'Upload CV to continue'
                : isExtractingProfile
                  ? 'Extracting Profile...'
                  : latestProfile
                    ? 'Review Profile'
                    : 'Extract Profile'}
            </Button>
          </div>
        </Card>

        <div className="flex items-center justify-between pt-4">
          <h3 className="font-bold text-slate-800">Matched Opportunities</h3>
          <button className="text-slate-900 text-xs font-bold hover:underline">View All</button>
        </div>
        <div className="space-y-3">
          {opportunities.length ? (
            opportunities.slice(0, 6).map((job) => (
              <Card key={job.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-slate-800">{job.title}</div>
                    <div className="text-sm text-slate-500">{job.organization} • {job.location}</div>
                  </div>
                  <Badge color="slate">{fitLabel(job.matchScore)}</Badge>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="primary"
                    className="flex-1 text-xs py-1.5"
                    onClick={() => {
                      setSelectedJob({ ...job, company: job.organization })
                      setIsJobDetailOpen(true)
                    }}
                  >
                    View Details
                  </Button>
                  <Button variant="outline" className="text-xs py-1.5" onClick={() => onCreateApplication(job.id, 'saved')}>
                    Save
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-4">
              <div className="text-sm text-slate-500">
                No matched opportunities yet. Run a search in Agent chat to populate this list.
              </div>
            </Card>
          )}
        </div>

        <div className="flex items-center justify-between pt-4">
          <h3 className="font-bold text-slate-800">Application Pipeline</h3>
          <button className="text-slate-900 text-xs font-bold hover:underline">Kanban</button>
        </div>
        {applications.length ? (
          <div className="grid md:grid-cols-2 gap-3">
            {applications.slice(0, 6).map((app) => (
              <Card key={app.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-800">{app.opportunity?.title || 'Application'}</div>
                    <div className="text-xs text-slate-500">
                      {app.opportunity?.organization || 'Unknown org'} • {app.opportunity?.location || 'Unknown location'}
                    </div>
                  </div>
                  <Badge color="emerald">{app.status}</Badge>
                </div>
                <div className="text-[11px] text-slate-400 mt-2">Updated {new Date(app.updatedAt).toLocaleString()}</div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-4 bg-slate-50 border-dashed border-2 border-slate-200">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-300 mb-3 shadow-sm">
                <Plus size={24} />
              </div>
              <div className="font-bold text-slate-500">No active applications</div>
              <p className="text-xs text-slate-400 mt-1">Start by saving a matched opportunity</p>
            </div>
          </Card>
        )}
      </div>

      <Modal
        isOpen={isRevampModalOpen}
        onClose={() => {
          setIsRevampModalOpen(false)
          setRevampResult(null)
          setIsRevamping(false)
        }}
        title={revampResult ? 'Revamped Document' : 'Revamp CV'}
      >
        <div className="space-y-6">
          {!revampResult && !isRevamping && (
            <>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Current Template</div>
                  <div className="text-xs text-slate-600 line-clamp-4 font-mono bg-white p-3 rounded-lg border border-slate-100">
                    {cvs[0]?.content}
                  </div>
                </div>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Target Role</span>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                    placeholder="e.g. Senior Frontend Engineer"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Tone</span>
                  <select
                    value={targetTone}
                    onChange={(e) => setTargetTone(e.target.value)}
                    className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                  >
                    <option>Professional</option>
                    <option>Bold & Creative</option>
                    <option>Academic</option>
                  </select>
                </label>
              </div>
              <Button className="w-full py-4 text-lg" disabled={!targetRole} onClick={handleRevamp}>
                Start Revamp
              </Button>
            </>
          )}

          {isRevamping && (
            <div className="space-y-6 py-4">
              <div className="relative p-6 bg-slate-900 rounded-2xl overflow-hidden min-h-[300px] flex flex-col justify-center">
                <motion.div
                  initial={{ top: 0 }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="absolute left-0 right-0 h-1 bg-slate-400 shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10"
                />

                <div className="space-y-3 opacity-40">
                  <div className="h-2 w-3/4 bg-slate-700 rounded" />
                  <div className="h-2 w-1/2 bg-slate-700 rounded" />
                  <div className="h-2 w-5/6 bg-slate-700 rounded" />
                  <div className="h-2 w-2/3 bg-slate-700 rounded" />
                  <div className="h-2 w-3/4 bg-slate-700 rounded" />
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
                  <div className="w-16 h-16 bg-slate-900 rounded-full border border-white/20 flex items-center justify-center text-white mb-4 shadow-2xl animate-pulse">
                    <Sparkles size={32} />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-2">AI is Revamping...</h4>
                  <p className="text-slate-300 text-xs max-w-[200px]">
                    Optimizing keywords for <span className="font-bold text-white">{targetRole}</span> and adjusting to{' '}
                    <span className="font-bold text-white">{targetTone}</span> tone.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                  <span>Analyzing job requirements...</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                  <span>Extracting impact metrics...</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-900 font-bold animate-pulse">
                  <div className="w-1 h-1 bg-slate-900 rounded-full" />
                  <span>Rewriting experience section...</span>
                </div>
              </div>
            </div>
          )}

          {revampResult && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-[60vh] overflow-y-auto relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-slate-900" />
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">Optimization Complete</div>
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ATS Optimized • {targetTone} Tone</div>
                    </div>
                  </div>
                  <Badge color="emerald">Optimized draft</Badge>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-sm text-slate-800 whitespace-pre-wrap font-serif leading-relaxed selection:bg-slate-100"
                >
                  {revampResult}
                </motion.div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setRevampResult(null)}>
                  Edit Criteria
                </Button>
                <Button variant="primary" className="flex-1 shadow-lg shadow-slate-200" onClick={saveRevampedCV}>
                  Save & Download PDF
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isJobDetailOpen} onClose={() => setIsJobDetailOpen(false)} title="Job Details">
        {selectedJob && (
          <div className="space-y-6">
            <div>
              <h4 className="text-2xl font-bold text-slate-900">{selectedJob.title}</h4>
              <p className="text-slate-500">{selectedJob.company} • {selectedJob.location}</p>
            </div>

            <div className="space-y-3">
              <h5 className="font-bold text-slate-800">Requirements</h5>
              <ul className="space-y-2">
                <li className="flex gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 5+ years of React experience</li>
                <li className="flex gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Strong TypeScript skills</li>
                <li className="flex gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Experience with Node.js</li>
              </ul>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <h5 className="font-bold text-slate-800 mb-2">Tailor Documents</h5>
              <p className="text-xs text-slate-500 mb-4">Generate a custom CV and cover letter for this specific role.</p>
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1 text-xs" icon={Sparkles}>Tailor CV</Button>
                <Button variant="outline" className="flex-1 text-xs">Cover Letter</Button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" icon={ExternalLink}>Official Link</Button>
              <Button variant="primary" className="flex-1">Apply Now</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
