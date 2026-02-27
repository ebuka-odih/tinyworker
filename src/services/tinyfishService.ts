import { TinyfishRunRequest, TinyfishSseEvent, Opportunity } from '../types'

function toOpportunities(items: any[], type: 'job' | 'scholarship' | 'visa'): Opportunity[] {
  return (items || []).map((it: any, idx: number) => ({
    id: String(it.id || `${type}-${Date.now()}-${idx}`),
    type,
    title: String(it.title || ''),
    organization: String(it.company || it.organization || ''),
    location: String(it.location || ''),
    description: String(it.description || ''),
    requirements: Array.isArray(it.requirements) ? it.requirements.map(String) : [],
    link: String(it.url || it.link || ''),
    deadline: it.deadline ? String(it.deadline) : undefined,
    matchScore: typeof it.matchScore === 'number' ? it.matchScore : undefined,
  }))
}

export const tinyfishService = {
  async run(req: TinyfishRunRequest): Promise<TinyfishSseEvent> {
    const token = localStorage.getItem('tinyworker.access_token') || ''
    const res = await fetch('/api/tinyfish/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(req),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(
        `TinyFish proxy failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`
      )
    }

    return (await res.json()) as TinyfishSseEvent
  },

  async searchJobsLinkedIn(query: string): Promise<Opportunity[]> {
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}&location=Remote`
    const goal = `Open the LinkedIn jobs search page. Without logging in, extract the first 10 job listings.
Return JSON with key jobs: an array of objects with: title, company, location, url.
If blocked, return JSON { blocked: true, reason: string }.`

    const evt = await this.run({
      url,
      goal,
      browser_profile: 'stealth',
      proxy_config: { enabled: false },
      feature_flags: { enable_agent_memory: false },
      api_integration: 'tinyfinder-ui',
    })

    const rj: any = evt?.resultJson || {}
    if (rj?.blocked) return []
    const jobs = rj.jobs || rj.result || []
    return toOpportunities(jobs, 'job')
  },
}
