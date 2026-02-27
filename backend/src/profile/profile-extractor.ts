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
  const rj: any = evt.resultJson
  if (typeof rj === 'string') {
    try {
      return JSON.parse(rj)
    } catch {
      return null
    }
  }
  return rj
}
