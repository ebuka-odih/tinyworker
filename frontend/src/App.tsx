import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Briefcase, FileText, LayoutDashboard, MessageSquare, Settings, Sparkles } from 'lucide-react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import {
  Application,
  AuthUser,
  CVData,
  CandidateIntent,
  CandidateProfile,
  Document,
  LinkedinImportJob,
  Opportunity,
} from './types'

import { ApplicationsView } from './components/app/views/ApplicationsView'
import { AuthView } from './components/app/views/AuthView'
import { ChatView } from './components/app/views/ChatView'
import { DashboardView } from './components/app/views/DashboardView'
import { BuildResumeView } from './components/app/views/BuildResumeView'
import { DocumentsView } from './components/app/views/DocumentsView'
import { GuidedQuestionsView } from './components/app/views/GuidedQuestionsView'
import { LandingPage } from './components/app/views/LandingPage'
import { ProfileReviewView } from './components/app/views/ProfileReviewView'
import { SettingsView } from './components/app/views/SettingsView'

const ACCESS_TOKEN_KEY = 'tinyworker.access_token'

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()

  const routeToTab = (pathname: string) => {
    if (pathname.startsWith('/auth')) return 'auth'
    if (pathname.startsWith('/chat')) return 'chat'
    if (pathname.startsWith('/documents')) return 'documents'
    if (pathname.startsWith('/applications')) return 'applications'
    if (pathname.startsWith('/settings')) return 'settings'
    if (pathname.startsWith('/dashboard')) return 'dashboard'
    if (pathname.startsWith('/build-resume')) return 'dashboard'
    if (pathname.startsWith('/profile-review')) return 'dashboard'
    if (pathname.startsWith('/guided-questions')) return 'dashboard'
    if (pathname === '/' || pathname.startsWith('/home')) return 'home'
    return 'dashboard'
  }

  const tabToRoute: Record<string, string> = {
    auth: '/auth',
    home: '/',
    dashboard: '/dashboard',
    chat: '/chat',
    documents: '/documents',
    applications: '/applications',
    settings: '/settings',
  }

  const isAuthRoute = location.pathname.startsWith('/auth')

  const [activeTab, setActiveTab] = useState(routeToTab(location.pathname))
  const [accessToken, setAccessToken] = useState<string>(() => localStorage.getItem(ACCESS_TOKEN_KEY) || '')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authBusy, setAuthBusy] = useState<boolean>(Boolean(localStorage.getItem(ACCESS_TOKEN_KEY)))
  const [authError, setAuthError] = useState<string | null>(null)

  const [cvs, setCvs] = useState<CVData[]>([])
  const [profiles, setProfiles] = useState<CandidateProfile[]>([])
  const [candidateIntent, setCandidateIntent] = useState<CandidateIntent | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [documents, setDocuments] = useState<Document[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [cvError, setCvError] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isExtractingProfile, setIsExtractingProfile] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingIntent, setIsSavingIntent] = useState(false)
  const [linkedinImportJob, setLinkedinImportJob] = useState<LinkedinImportJob | null>(null)
  const [linkedinImportError, setLinkedinImportError] = useState<string | null>(null)
  const [intentError, setIntentError] = useState<string | null>(null)
  const [isStartingLinkedinImport, setIsStartingLinkedinImport] = useState(false)

  useEffect(() => {
    const next = routeToTab(location.pathname)
    if (next !== activeTab) setActiveTab(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const storeAccessToken = (token: string) => {
    setAccessToken(token)
    if (token) {
      setAuthBusy(true)
      localStorage.setItem(ACCESS_TOKEN_KEY, token)
    } else {
      setAuthBusy(false)
      localStorage.removeItem(ACCESS_TOKEN_KEY)
    }
  }

  const signOut = () => {
    storeAccessToken('')
    setAuthUser(null)
    setAuthError(null)
    setCvs([])
    setProfiles([])
    setCandidateIntent(null)
    setOpportunities([])
    setApplications([])
    setDocuments([])
    setLinkedinImportJob(null)
    setLinkedinImportError(null)
    navigate('/auth')
  }

  const authedFetch = async (input: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {})
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    const response = await fetch(input, { ...init, headers })
    if (response.status === 401 && accessToken) {
      signOut()
    }
    return response
  }

  const hydrateAuthUser = async (token: string) => {
    setAuthBusy(true)
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Session expired')
      const data = await res.json()
      if (!data?.user) throw new Error('Invalid auth response')
      setAuthUser(data.user as AuthUser)
      setAuthError(null)
    } catch (e: any) {
      storeAccessToken('')
      setAuthUser(null)
      setAuthError(e?.message || 'Failed to restore session')
    } finally {
      setAuthBusy(false)
    }
  }

  const loadCvs = async () => {
    if (!accessToken) {
      setCvs([])
      return
    }
    try {
      const res = await authedFetch('/api/cv')
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data?.cvs)) return
      const mapped: CVData[] = data.cvs.map((c: any) => ({
        id: String(c.id),
        name: String(c.filename || 'CV'),
        version: 1,
        content: '',
        createdAt: String(c.createdAt || c.uploadedAt || new Date().toISOString()),
      }))
      setCvs(mapped)
    } catch {
      // ignore
    }
  }

  const uploadCv = async (file: File) => {
    if (!accessToken) {
      setCvError('Please sign in first.')
      navigate('/auth')
      return
    }
    setCvError(null)
    setIsLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await authedFetch('/api/cv/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'Upload failed')
      }
      await loadCvs()
    } catch (e: any) {
      setCvError(e?.message || 'Upload failed')
    } finally {
      setIsLoading(false)
    }
  }

  const readErrorMessage = async (res: Response, fallback: string) => {
    const raw = await res.text().catch(() => '')
    if (!raw) return fallback
    try {
      const parsed = JSON.parse(raw)
      return parsed?.error || parsed?.message || raw || fallback
    } catch {
      return raw || fallback
    }
  }

  const startLinkedinImport = async (linkedinUrl: string) => {
    if (!accessToken) {
      setLinkedinImportError('Please sign in first.')
      navigate('/auth')
      return
    }
    setCvError(null)
    setProfileError(null)
    setLinkedinImportError(null)
    setIsStartingLinkedinImport(true)
    try {
      const res = await authedFetch('/api/cv/import-linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinUrl }),
      })
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Failed to start LinkedIn import'))
      }
      const data = await res.json()
      const job = data?.job as LinkedinImportJob | undefined
      if (!job?.id) throw new Error('LinkedIn import started without a job id')
      setLinkedinImportJob(job)
    } catch (e: any) {
      setLinkedinImportError(e?.message || 'Failed to start LinkedIn import')
    } finally {
      setIsStartingLinkedinImport(false)
    }
  }

  const refreshLinkedinImportJob = async (jobId: string) => {
    if (!accessToken) return
    try {
      const res = await authedFetch(`/api/cv/import-linkedin/${jobId}`)
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Failed to fetch LinkedIn import status'))
      }
      const data = await res.json()
      const job = data?.job as LinkedinImportJob | undefined
      if (!job?.id) return
      setLinkedinImportJob(job)
      if (job.status === 'succeeded') {
        setLinkedinImportError(null)
        await loadCvs()
        await loadProfiles()
      } else if (job.status === 'failed') {
        setLinkedinImportError(job.error || 'LinkedIn import failed')
      }
    } catch (e: any) {
      setLinkedinImportError(e?.message || 'Failed to fetch LinkedIn import status')
    }
  }

  const loadProfiles = async () => {
    if (!accessToken) {
      setProfiles([])
      return
    }
    try {
      const res = await authedFetch('/api/profile')
      if (!res.ok) return
      const data = await res.json()
      if (!Array.isArray(data?.profiles)) return
      setProfiles(data.profiles as CandidateProfile[])
    } catch {
      // ignore
    }
  }

  const loadCandidateIntent = async () => {
    if (!accessToken) {
      setCandidateIntent(null)
      return
    }
    try {
      const res = await authedFetch('/api/intent')
      if (!res.ok) return
      const data = await res.json()
      setCandidateIntent(data?.intent ? (data.intent as CandidateIntent) : null)
      setIntentError(null)
    } catch {
      // ignore
    }
  }

  const extractProfileFromCv = async (cvId: string) => {
    setProfileError(null)
    setIsExtractingProfile(true)
    try {
      const res = await authedFetch(`/api/profile/extract/${cvId}`, { method: 'POST' })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'Profile extraction failed')
      }
      await loadProfiles()
      navigate('/profile-review')
    } catch (e: any) {
      setProfileError(e?.message || 'Profile extraction failed')
    } finally {
      setIsExtractingProfile(false)
    }
  }

  const saveProfilePreferences = async (profileId: string, payload: any) => {
    setIsSavingProfile(true)
    setProfileError(null)
    try {
      const res = await authedFetch(`/api/profile/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'Failed to save profile')
      }
      await loadProfiles()
      await loadDocuments()
    } catch (e: any) {
      setProfileError(e?.message || 'Failed to save profile')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const saveCandidateIntent = async (payload: Partial<CandidateIntent>) => {
    setIsSavingIntent(true)
    setIntentError(null)
    try {
      const res = await authedFetch('/api/intent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'Failed to save guided intent')
      }
      const data = await res.json()
      setCandidateIntent(data?.intent ? (data.intent as CandidateIntent) : null)
      setIntentError(null)
    } catch (e: any) {
      setIntentError(e?.message || 'Failed to save guided intent')
      throw e
    } finally {
      setIsSavingIntent(false)
    }
  }

  const mapOpportunityRecord = (o: any): Opportunity => ({
    id: String(o.id),
    type: (o.type as Opportunity['type']) || 'job',
    title: String(o.title || ''),
    organization: String(o.organization || ''),
    location: String(o.location || ''),
    description: String(o.description || ''),
    requirements: Array.isArray(o.requirements) ? o.requirements.map(String) : [],
    link: String(o.link || ''),
    deadline: o.deadline ? String(o.deadline) : undefined,
    matchScore: typeof o.matchScore === 'number' ? o.matchScore : undefined,
  })

  const loadOpportunities = async () => {
    if (!accessToken) {
      setOpportunities([])
      return
    }
    try {
      const res = await authedFetch('/api/opportunities')
      if (!res.ok) return
      const data = await res.json()
      const rows = Array.isArray(data?.opportunities) ? data.opportunities : []
      setOpportunities(rows.map(mapOpportunityRecord))
    } catch {
      // ignore
    }
  }

  const loadApplications = async () => {
    if (!accessToken) {
      setApplications([])
      return
    }
    try {
      const res = await authedFetch('/api/applications')
      if (!res.ok) return
      const data = await res.json()
      const rows = Array.isArray(data?.applications) ? data.applications : []
      const mapped: Application[] = rows.map((a: any) => ({
        id: String(a.id),
        opportunityId: String(a.opportunityId),
        status: (a.status as Application['status']) || 'saved',
        notes: a.notes ? String(a.notes) : undefined,
        createdAt: a.createdAt ? String(a.createdAt) : undefined,
        updatedAt: String(a.updatedAt || a.createdAt || new Date().toISOString()),
        opportunity: a.opportunity ? mapOpportunityRecord(a.opportunity) : undefined,
      }))
      setApplications(mapped)
    } catch {
      // ignore
    }
  }

  const loadDocuments = async () => {
    if (!accessToken) {
      setDocuments([])
      return
    }
    try {
      const res = await authedFetch('/api/documents')
      if (!res.ok) return
      const data = await res.json()
      const rows = Array.isArray(data?.documents) ? data.documents : []
      const mapped: Document[] = rows.map((d: any) => ({
        id: String(d.id),
        type: (d.type as Document['type']) || 'cv',
        title: String(d.title || 'Untitled'),
        content: String(d.content || ''),
        opportunityId: d.opportunityId ? String(d.opportunityId) : undefined,
        createdAt: String(d.createdAt || new Date().toISOString()),
      }))
      setDocuments(mapped)
    } catch {
      // ignore
    }
  }

  const importOpportunities = async (items: Opportunity[]) => {
    if (!items.length) return
    try {
      await authedFetch('/api/opportunities/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((it) => ({
            type: it.type,
            title: it.title,
            organization: it.organization,
            location: it.location,
            description: it.description,
            requirements: it.requirements,
            link: it.link,
            deadline: it.deadline,
            matchScore: it.matchScore,
            source: 'tinyfish-ui',
          })),
        }),
      })
      await loadOpportunities()
    } catch {
      // ignore import failures in chat flow
    }
  }

  const createApplication = async (opportunityId: string, status: Application['status'] = 'saved') => {
    try {
      const res = await authedFetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId, status }),
      })
      if (!res.ok) throw new Error('Failed to create application')
      await loadApplications()
    } catch (e: any) {
      setProfileError(e?.message || 'Failed to create application')
    }
  }

  const createDocument = async (doc: Pick<Document, 'type' | 'title' | 'content' | 'opportunityId'>) => {
    const res = await authedFetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(t || 'Failed to create document')
    }
    await loadDocuments()
  }

  const deleteDocument = async (id: string) => {
    const res = await authedFetch(`/api/documents/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await loadDocuments()
    }
  }

  useEffect(() => {
    if (!accessToken) {
      setAuthBusy(false)
      setAuthUser(null)
      setAuthError(null)
      setCvs([])
      setCandidateIntent(null)
      return
    }
    hydrateAuthUser(accessToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  useEffect(() => {
    if (accessToken && authUser) {
      loadCvs()
      loadProfiles()
      loadCandidateIntent()
      loadOpportunities()
      loadApplications()
      loadDocuments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, authUser?.userId])

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!accessToken) return <Navigate to="/auth" replace />
    if (authBusy) {
      return <div className="min-h-screen flex items-center justify-center text-slate-500">Restoring session...</div>
    }
    if (!authUser) return <Navigate to="/auth" replace />
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {!isAuthRoute ? (
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-6 fixed h-full z-50">
          <div className="flex items-center gap-2 font-bold text-xl text-slate-900 mb-10">
            <Sparkles className="fill-slate-900" />
            <span>Opportunity Agent</span>
          </div>
          <nav className="flex-1 space-y-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'chat', label: 'Agent', icon: MessageSquare },
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'applications', label: 'Applications', icon: Briefcase },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(tabToRoute[item.id] || '/dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold">
                {authUser?.email?.slice(0, 2).toUpperCase() || 'TW'}
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 truncate max-w-[150px]">
                  {authUser?.email || 'TinyWorker User'}
                </div>
                <div className="text-xs text-slate-500">Secure Session</div>
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {!isAuthRoute ? <div className="hidden md:block w-64 shrink-0" /> : null}

      <main className="flex-1 overflow-hidden h-screen flex flex-col relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className={`flex-1 h-full flex flex-col ${activeTab !== 'chat' ? 'overflow-y-auto' : 'overflow-hidden'}`}
          >
            <Routes>
              <Route
                path="/auth"
                element={
                  <AuthView
                    authError={authError}
                    onAuthErrorClear={() => setAuthError(null)}
                    onAuthSuccess={(token) => {
                      storeAccessToken(token)
                      setAuthError(null)
                      navigate('/dashboard')
                    }}
                  />
                }
              />
              <Route
                path="/"
                element={<LandingPage onSignIn={() => navigate('/auth')} onStartChat={() => navigate('/chat')} onUploadCv={() => navigate('/dashboard')} />}
              />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardView
                      authUser={authUser}
                      cvs={cvs}
                      opportunities={opportunities}
                      applications={applications}
                      profiles={profiles}
                      isLoading={isLoading}
                      isExtractingProfile={isExtractingProfile}
                      cvError={cvError}
                      profileError={profileError}
                      onUploadCv={uploadCv}
                      onOpenBuildResume={() => navigate('/build-resume')}
                      onOpenGuidedQuestions={() => navigate('/guided-questions')}
                      onExtractProfile={extractProfileFromCv}
                      onCreateApplication={createApplication}
                      onCreateDocument={createDocument}
                      onNavigateProfileReview={() => navigate('/profile-review')}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/build-resume"
                element={
                  <ProtectedRoute>
                    <BuildResumeView
                      isStarting={isStartingLinkedinImport}
                      job={linkedinImportJob}
                      error={linkedinImportError}
                      onStart={startLinkedinImport}
                      onRefresh={refreshLinkedinImportJob}
                      onBackDashboard={() => navigate('/dashboard')}
                      onOpenProfileReview={() => navigate('/profile-review')}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile-review"
                element={
                  <ProtectedRoute>
                    <ProfileReviewView
                      cvs={cvs}
                      profiles={profiles}
                      profileError={profileError}
                      isExtractingProfile={isExtractingProfile}
                      isSavingProfile={isSavingProfile}
                      onGoDashboard={() => navigate('/dashboard')}
                      onExtractProfile={extractProfileFromCv}
                      onSaveProfilePreferences={saveProfilePreferences}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/guided-questions"
                element={
                  <ProtectedRoute>
                    <GuidedQuestionsView
                      intent={candidateIntent}
                      intentError={intentError}
                      isSavingIntent={isSavingIntent}
                      onSaveIntent={saveCandidateIntent}
                      onGoDashboard={() => navigate('/dashboard')}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ChatView
                      authUser={authUser}
                      cvs={cvs}
                      profiles={profiles}
                      candidateIntent={candidateIntent}
                      opportunities={opportunities}
                      applications={applications}
                      documents={documents}
                      cvError={cvError}
                      linkedinImportError={linkedinImportError}
                      onImportOpportunities={importOpportunities}
                      onUploadCv={uploadCv}
                      onStartLinkedinImport={startLinkedinImport}
                      onCreateApplication={createApplication}
                      onDeleteDocument={deleteDocument}
                      onSignOut={signOut}
                      sessionOwnerId={authUser?.userId || 'anonymous'}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute>
                    <DocumentsView documents={documents} onDeleteDocument={deleteDocument} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/applications"
                element={
                  <ProtectedRoute>
                    <ApplicationsView applications={applications} onGoDashboard={() => navigate('/dashboard')} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsView onSignOut={signOut} />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {!isAuthRoute ? (
        <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
            { id: 'chat', icon: MessageSquare, label: 'Agent' },
            { id: 'documents', icon: FileText, label: 'Docs' },
            { id: 'applications', icon: Briefcase, label: 'Apps' },
            { id: 'settings', icon: Settings, label: 'Settings' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(tabToRoute[item.id] || '/dashboard')}
              className={`flex flex-col items-center gap-1 ${activeTab === item.id ? 'text-slate-900' : 'text-slate-400'}`}
            >
              <item.icon size={22} className={activeTab === item.id ? 'stroke-[2.5px]' : ''} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
