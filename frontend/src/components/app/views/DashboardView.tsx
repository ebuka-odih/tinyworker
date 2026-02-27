import React, { useState } from 'react'
import {
  Bell,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FileText,
  Linkedin,
  Plus,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react'
import { motion } from 'motion/react'

import { Application, AuthUser, CVData, CandidateProfile, Document, Opportunity } from '../../../types'
import { Badge, Button, Card, Modal } from '../AppPrimitives'

export function DashboardView({
  authUser,
  cvs,
  opportunities,
  applications,
  profiles,
  isLoading,
  isExtractingProfile,
  cvError,
  profileError,
  onUploadCv,
  onImportLinkedinCv,
  onExtractProfile,
  onCreateApplication,
  onCreateDocument,
  onNavigateProfileReview,
}: {
  authUser: AuthUser | null
  cvs: CVData[]
  opportunities: Opportunity[]
  applications: Application[]
  profiles: CandidateProfile[]
  isLoading: boolean
  isExtractingProfile: boolean
  cvError: string | null
  profileError: string | null
  onUploadCv: (file: File) => Promise<void>
  onImportLinkedinCv: (linkedinUrl: string) => Promise<void>
  onExtractProfile: (cvId: string) => Promise<void>
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
  const [linkedinUrlInput, setLinkedinUrlInput] = useState('')
  const latestProfile = profiles[0]
  const cvFileInputRef = React.useRef<HTMLInputElement>(null)

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
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">Welcome back, {authUser?.email?.split('@')[0] || 'there'}</p>
        </div>
        <button className="relative p-2 bg-white border border-slate-200 rounded-xl text-slate-600">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
        </button>
      </header>

      <Card className="bg-slate-900 text-white border-none shadow-xl shadow-slate-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Current Goal</div>
            <div className="text-lg font-bold">Software Engineer in Germany</div>
          </div>
          <Button variant="ghost" className="text-white hover:bg-white/10 p-1">
            <Edit3 size={16} />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 text-[10px] uppercase font-bold">CV Score</div>
            <div className="text-xl font-bold">85/100</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 text-[10px] uppercase font-bold">Matches</div>
            <div className="text-xl font-bold">{opportunities.length}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => cvFileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-400 transition-colors group"
        >
          <div className="w-10 h-10 bg-slate-100 text-slate-900 rounded-full flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
            <Upload size={20} />
          </div>
          <span className="text-xs font-bold text-slate-700">{isLoading ? 'Uploading…' : 'Upload CV'}</span>
        </button>
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
        <button className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-emerald-200 transition-colors group">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <Search size={20} />
          </div>
          <span className="text-xs font-bold text-slate-700">Find Jobs</span>
        </button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-sky-50 text-sky-600 rounded-lg flex items-center justify-center">
            <Linkedin size={16} />
          </div>
          <div className="text-sm font-bold text-slate-800">Or build from LinkedIn profile</div>
        </div>
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const value = linkedinUrlInput.trim()
            if (!value) return
            await onImportLinkedinCv(value)
            setLinkedinUrlInput('')
          }}
        >
          <input
            type="url"
            value={linkedinUrlInput}
            onChange={(e) => setLinkedinUrlInput(e.target.value)}
            placeholder="https://www.linkedin.com/in/your-profile"
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none text-sm"
          />
          <Button type="submit" disabled={isLoading || !linkedinUrlInput.trim()} className="sm:w-auto">
            {isLoading ? 'Importing...' : 'Import LinkedIn'}
          </Button>
        </form>
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
                  <Badge color="slate">{job.matchScore ? `${Math.round(job.matchScore)}%` : 'Saved'} Match</Badge>
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
                  <Badge color="emerald">+15% Score</Badge>
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
