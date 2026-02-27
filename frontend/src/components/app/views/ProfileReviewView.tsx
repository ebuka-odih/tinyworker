import React, { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

import { CVData, CandidateProfile } from '../../../types'
import { Badge, Button, Card } from '../AppPrimitives'

function normalizeTextArray(value: any): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => String(v || '').trim())
    .filter(Boolean)
}

export function ProfileReviewView({
  cvs,
  profiles,
  profileError,
  isExtractingProfile,
  isSavingProfile,
  onGoDashboard,
  onExtractProfile,
  onSaveProfilePreferences,
}: {
  cvs: CVData[]
  profiles: CandidateProfile[]
  profileError: string | null
  isExtractingProfile: boolean
  isSavingProfile: boolean
  onGoDashboard: () => void
  onExtractProfile: (cvId: string) => Promise<void>
  onSaveProfilePreferences: (profileId: string, payload: any) => Promise<void>
}) {
  const latestProfile = profiles[0]
  const [preferredRolesInput, setPreferredRolesInput] = useState('')
  const [preferredLocationsInput, setPreferredLocationsInput] = useState('')
  const [github, setGithub] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [portfolio, setPortfolio] = useState('')

  useEffect(() => {
    if (!latestProfile) return
    setPreferredRolesInput(normalizeTextArray(latestProfile.preferredRoles).join(', '))
    setPreferredLocationsInput(normalizeTextArray(latestProfile.preferredLocations).join(', '))
    const links = (latestProfile.links || {}) as Record<string, any>
    setGithub(String(links.github || ''))
    setLinkedin(String(links.linkedin || ''))
    setPortfolio(String(links.portfolio || ''))
  }, [latestProfile?.id])

  if (!cvs.length) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Review Profile</h2>
        <Card>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Upload your CV first, then extract a profile.</p>
            <Button onClick={onGoDashboard}>Go to Dashboard</Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!latestProfile) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Review Profile</h2>
        <Card>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Extract your candidate profile from the latest CV to review and edit preferences.
            </p>
            <Button onClick={() => onExtractProfile(cvs[0].id)} disabled={isExtractingProfile} icon={Sparkles}>
              {isExtractingProfile ? 'Extracting...' : 'Extract Profile'}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const roles = Array.isArray(latestProfile.roles) ? latestProfile.roles : []
  const skills = Array.isArray(latestProfile.skills) ? latestProfile.skills : []
  const keywords = normalizeTextArray(latestProfile.keywords)
  const tools = normalizeTextArray(latestProfile.toolsStack)

  const save = async () => {
    const toList = (raw: string) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

    await onSaveProfilePreferences(latestProfile.id, {
      preferredRoles: toList(preferredRolesInput),
      preferredLocations: toList(preferredLocationsInput),
      links: {
        github: github.trim() || null,
        linkedin: linkedin.trim() || null,
        portfolio: portfolio.trim() || null,
      },
    })
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Review Profile</h2>
          <p className="text-sm text-slate-500">Extracted from your CV and editable for matching.</p>
        </div>
        <Button onClick={save} disabled={isSavingProfile}>
          {isSavingProfile ? 'Saving...' : 'Save Profile Preferences'}
        </Button>
      </header>

      {profileError ? (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">{profileError}</div>
      ) : null}

      <Card>
        <div className="space-y-4">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Name</div>
            <div className="text-slate-900 font-semibold">{latestProfile.name || 'Unknown'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Headline</div>
            <div className="text-slate-700">{latestProfile.titleHeadline || 'Not detected'}</div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Seniority</div>
              <div className="text-slate-700">{latestProfile.seniorityGuess || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-bold">Years Experience</div>
              <div className="text-slate-700">
                {typeof latestProfile.yearsExperienceGuess === 'number' ? latestProfile.yearsExperienceGuess : 'Unknown'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-bold text-slate-800 mb-3">Roles</h3>
          <div className="space-y-3 text-sm">
            {roles.length ? (
              roles.map((r: any, idx: number) => (
                <div key={`${r?.title || 'role'}-${idx}`} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="font-semibold text-slate-900">{String(r?.title || 'Untitled role')}</div>
                  <div className="text-slate-500 text-xs">{[r?.company, r?.dates].filter(Boolean).join(' • ') || 'No metadata'}</div>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-sm">No roles extracted yet.</div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="font-bold text-slate-800 mb-3">Skills</h3>
          <div className="flex flex-wrap gap-2">
            {skills.length ? (
              skills.map((s: any, idx: number) => (
                <Badge key={`${s?.name || 'skill'}-${idx}`} color="slate">
                  {String(s?.name || 'Unknown')}
                </Badge>
              ))
            ) : (
              <div className="text-slate-500 text-sm">No skills extracted yet.</div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold text-slate-800 mb-3">Keywords & Tools</h3>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <Badge key={k} color="indigo">{k}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {tools.map((t) => (
              <Badge key={t} color="emerald">{t}</Badge>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-800 mb-4">Editable Preferences</h3>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Preferred Roles (comma-separated)</span>
            <input
              type="text"
              value={preferredRolesInput}
              onChange={(e) => setPreferredRolesInput(e.target.value)}
              className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
              placeholder="Frontend Engineer, Fullstack Engineer"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Preferred Locations (comma-separated)</span>
            <input
              type="text"
              value={preferredLocationsInput}
              onChange={(e) => setPreferredLocationsInput(e.target.value)}
              className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
              placeholder="Berlin, Munich, Remote"
            />
          </label>
          <div className="grid md:grid-cols-3 gap-3">
            <input
              type="url"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
              placeholder="GitHub URL"
            />
            <input
              type="url"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
              placeholder="LinkedIn URL"
            />
            <input
              type="url"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
              placeholder="Portfolio URL"
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
