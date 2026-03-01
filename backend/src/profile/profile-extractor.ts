import { runTinyfish } from '../tinyfish/tinyfish.client'

export async function extractCandidateProfileFromCvText(cvText: string) {
  const trimmed = cvText.trim().slice(0, 25000) // keep prompt bounded

  const goal = `You are a CV profile extractor.

Given the CV text below, produce STRICT JSON (no markdown, no commentary) in this schema:
{
  "name": string|null,
  "title_headline": string|null,
  "seniority_guess": string|null,
  "years_experience_guess": number|null,
  "roles": [{"title": string, "company": string|null, "dates": string|null, "highlights": string[]}],
  "skills": [{"name": string, "confidence": number, "evidence": string[]}],
  "tools_stack": string[],
  "industries": string[],
  "achievements": string[],
  "education": any[],
  "certifications": string[],
  "keywords": string[],
  "links": {"github": string|null, "linkedin": string|null, "portfolio": string|null},
  "red_flags": [{"type": string, "note": string}]
}

Rules:
- Do NOT fabricate experience.
- Confidence is 0..1.
- keywords should be deduped, lowercased where appropriate.

CV TEXT:
"""
${trimmed}
"""
`

  // TinyFish needs a URL; use a neutral page. The goal contains the real content.
  const evt = await runTinyfish({
    url: 'https://example.com',
    goal,
    browser_profile: 'lite',
    proxy_config: { enabled: false },
  })

  // TinyFish often returns JSON as a string. Normalize.
  const rj: any =
    evt?.resultJson ??
    (evt as any)?.result_json ??
    (evt as any)?.result ??
    (evt as any)?.data?.resultJson ??
    (evt as any)?.data?.result_json ??
    (evt as any)?.data?.result
  if (typeof rj === 'string') {
    try {
      return JSON.parse(rj)
    } catch {
      return null
    }
  }
  return rj
}

type FallbackLinks = {
  github: string | null
  linkedin: string | null
  portfolio: string | null
}

function detectLinks(text: string): FallbackLinks {
  const links: FallbackLinks = { github: null, linkedin: null, portfolio: null }
  const matches = text.match(/(?:https?:\/\/|www\.)[^\s)]+/gi) || []
  for (const raw of matches) {
    const normalized = raw.startsWith('http') ? raw : `https://${raw}`
    const lower = normalized.toLowerCase()
    if (!links.github && lower.includes('github.com')) links.github = normalized
    else if (!links.linkedin && lower.includes('linkedin.com')) links.linkedin = normalized
    else if (!links.portfolio) links.portfolio = normalized
  }
  return links
}

function inferName(lines: string[]): string | null {
  const candidate = lines.find((line) => /^[a-z ,.'-]{3,80}$/i.test(line) && line.split(/\s+/).length <= 5)
  return candidate || null
}

function inferYearsExperience(text: string): number | null {
  const match = text.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i)
  if (!match) return null
  const years = Number(match[1])
  if (!Number.isFinite(years)) return null
  return years
}

const KNOWN_TERMS = [
  'typescript',
  'javascript',
  'react',
  'next.js',
  'node.js',
  'nestjs',
  'express',
  'python',
  'java',
  'c#',
  'php',
  'sql',
  'postgresql',
  'mysql',
  'mongodb',
  'docker',
  'kubernetes',
  'aws',
  'azure',
  'gcp',
  'graphql',
  'rest',
  'git',
  'ci/cd',
]

function inferTerms(text: string): string[] {
  const lower = text.toLowerCase()
  return KNOWN_TERMS.filter((term) => lower.includes(term))
}

export function buildFallbackCandidateProfileFromCvText(cvText: string, warning?: string | null) {
  const trimmed = String(cvText || '').trim()
  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30)

  const name = inferName(lines)
  const years = inferYearsExperience(trimmed)
  const terms = inferTerms(trimmed)
  const links = detectLinks(trimmed)

  return {
    name,
    title_headline: lines.find((line) => line !== name && line.length >= 12 && line.length <= 100) || null,
    seniority_guess: years && years >= 7 ? 'senior' : years && years >= 3 ? 'mid' : years ? 'junior' : null,
    years_experience_guess: years,
    roles: [],
    skills: terms.slice(0, 12).map((term) => ({ name: term, confidence: 0.45, evidence: [] as string[] })),
    tools_stack: terms,
    industries: [],
    achievements: [],
    education: [],
    certifications: [],
    keywords: terms,
    links,
    red_flags: warning ? [{ type: 'partial_extraction', note: warning }] : [],
  }
}
