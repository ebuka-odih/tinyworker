import {
  Body,
  NotFoundException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import type { Request } from 'express'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import { JwtAuthGuard } from '../auth/jwt.guard'
import { PrismaService } from '../prisma/prisma.service'
import { extractTextFromFile } from './text-extract'
import { runTinyfish } from '../tinyfish/tinyfish.client'
import { buildFallbackCandidateProfileFromCvText } from '../profile/profile-extractor'

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

const UPLOAD_ROOT = process.env.CV_UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads')
const LINKEDIN_BROWSER_PROFILE: 'lite' | 'stealth' =
  String(process.env.TINYFISH_LINKEDIN_BROWSER_PROFILE || '').toLowerCase() === 'lite'
    ? 'lite'
    : 'stealth'
const LINKEDIN_PROXY_ENABLED = /^(1|true|yes)$/i.test(
  String(process.env.TINYFISH_LINKEDIN_PROXY_ENABLED ?? 'true'),
)
const LINKEDIN_PROXY_COUNTRY = String(process.env.TINYFISH_LINKEDIN_PROXY_COUNTRY || '')
  .trim()
  .toUpperCase()
const LINKEDIN_IMPORT_JOB_TTL_MS = 1000 * 60 * 60

const LinkedinImportSchema = z.object({
  linkedinUrl: z
    .string()
    .url()
    .refine((value) => {
      try {
        const u = new URL(value)
        return u.hostname.toLowerCase().includes('linkedin.com')
      } catch {
        return false
      }
    }, 'Must be a valid LinkedIn URL'),
})

function normalizeResultJson(resultJson: any): any {
  if (!resultJson) return null
  if (typeof resultJson === 'string') {
    try {
      return JSON.parse(resultJson)
    } catch {
      return null
    }
  }
  if (typeof resultJson === 'object') return resultJson
  return null
}

function toStringArray(value: any): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean)
}

function buildExtractedTextFromLinkedinResult(result: any): string {
  const preferredText = String(result?.resume_text || result?.raw_text || '').trim()
  if (preferredText) return preferredText

  const chunks = [
    String(result?.name || ''),
    String(result?.title_headline || ''),
    ...toStringArray(result?.achievements),
    ...toStringArray(result?.keywords),
  ]
  return chunks
    .map((v) => v.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function safeFilename(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'linkedin_profile'
}

function buildProxyConfig(enabled: boolean): { enabled: boolean; country_code?: string } {
  if (!enabled) return { enabled: false }
  return {
    enabled: true,
    ...(LINKEDIN_PROXY_COUNTRY ? { country_code: LINKEDIN_PROXY_COUNTRY } : {}),
  }
}

type LinkedinImportJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'
type LinkedinImportJobLog = {
  at: string
  message: string
}
type LinkedinImportJob = {
  id: string
  userId: string
  linkedinUrl: string
  status: LinkedinImportJobStatus
  stage: string
  logs: LinkedinImportJobLog[]
  error: string | null
  cvId: string | null
  profileId: string | null
  createdAt: string
  updatedAt: string
}

const linkedinImportJobs = new Map<string, LinkedinImportJob>()

function nowIso() {
  return new Date().toISOString()
}

function pruneOldLinkedinJobs() {
  const cutoff = Date.now() - LINKEDIN_IMPORT_JOB_TTL_MS
  for (const [jobId, job] of linkedinImportJobs.entries()) {
    const ts = Date.parse(job.updatedAt)
    if (!Number.isFinite(ts) || ts < cutoff) {
      linkedinImportJobs.delete(jobId)
    }
  }
}

function toPublicJob(job: LinkedinImportJob) {
  return {
    id: job.id,
    linkedinUrl: job.linkedinUrl,
    status: job.status,
    stage: job.stage,
    logs: job.logs,
    error: job.error,
    cvId: job.cvId,
    profileId: job.profileId,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

@Controller('cv')
@UseGuards(JwtAuthGuard)
export class CvController {
  constructor(private prisma: PrismaService) {
    ensureDir(UPLOAD_ROOT)
  }

  @Get()
  async list(@Req() req: any) {
    const userId = req.user.userId as string
    const cvs = await this.prisma.cV.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    })
    return { cvs }
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req: Request, _file: any, cb: any) => {
          ensureDir(UPLOAD_ROOT)
          cb(null, UPLOAD_ROOT)
        },
        filename: (_req: Request, file: any, cb: any) => {
          const safe = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_')
          cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`)
        },
      }),
      limits: { fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype === 'application/pdf' ||
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.originalname.toLowerCase().endsWith('.pdf') ||
          file.originalname.toLowerCase().endsWith('.docx')
        cb(ok ? null : new Error('Only PDF or DOCX supported'), ok)
      },
    }),
  )
  async upload(@UploadedFile() file: any, @Req() req: any) {
    if (!file) throw new BadRequestException('Missing file')

    const userId = req.user.userId as string
    let extractedText = ''
    try {
      extractedText = await extractTextFromFile(file.path, file.mimetype || undefined)
    } catch (e: any) {
      throw new BadRequestException({
        error: 'Failed to extract text from uploaded CV',
        details: e?.message || String(e),
      })
    }

    const accessToken = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

    const rec = await this.prisma.cV.create({
      data: {
        userId,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: file.path,
        extractedText,
        accessToken,
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    })

    return { ok: true, cv: rec }
  }

  @Post('import-linkedin')
  async importFromLinkedin(@Body() body: any, @Req() req: any) {
    const userId = req.user.userId as string

    let parsed: z.infer<typeof LinkedinImportSchema>
    try {
      parsed = LinkedinImportSchema.parse(body || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    const linkedinUrl = parsed.linkedinUrl.trim()
    pruneOldLinkedinJobs()
    const activeJob = Array.from(linkedinImportJobs.values()).find(
      (job) =>
        job.userId === userId &&
        job.linkedinUrl === linkedinUrl &&
        (job.status === 'queued' || job.status === 'running'),
    )
    if (activeJob) {
      return { ok: true, jobId: activeJob.id, job: toPublicJob(activeJob) }
    }

    const jobId = randomUUID()
    const createdAt = nowIso()
    const job: LinkedinImportJob = {
      id: jobId,
      userId,
      linkedinUrl,
      status: 'queued',
      stage: 'queued',
      logs: [{ at: createdAt, message: 'Queued LinkedIn resume build request' }],
      error: null,
      cvId: null,
      profileId: null,
      createdAt,
      updatedAt: createdAt,
    }
    linkedinImportJobs.set(jobId, job)

    void this.runLinkedinImportJob(jobId).catch((e: any) => {
      const msg = e?.message || String(e)
      this.failJob(jobId, msg)
    })

    return { ok: true, jobId, job: toPublicJob(job) }
  }

  @Get('import-linkedin/:jobId')
  async getLinkedinImportJob(@Req() req: any, @Param('jobId') jobId: string) {
    const userId = req.user.userId as string
    const job = linkedinImportJobs.get(jobId)
    if (!job || job.userId !== userId) {
      throw new NotFoundException('LinkedIn import job not found')
    }
    return { ok: true, job: toPublicJob(job) }
  }

  private pushJobLog(jobId: string, message: string) {
    const job = linkedinImportJobs.get(jobId)
    if (!job) return
    const at = nowIso()
    job.logs.push({ at, message })
    job.updatedAt = at
  }

  private setJobStage(jobId: string, stage: string, status: LinkedinImportJobStatus) {
    const job = linkedinImportJobs.get(jobId)
    if (!job) return
    job.stage = stage
    job.status = status
    job.updatedAt = nowIso()
  }

  private completeJob(jobId: string, payload: { cvId: string; profileId?: string | null }) {
    const job = linkedinImportJobs.get(jobId)
    if (!job) return
    job.status = 'succeeded'
    job.stage = 'completed'
    job.cvId = payload.cvId
    job.profileId = payload.profileId ?? null
    job.updatedAt = nowIso()
    job.error = null
    this.pushJobLog(jobId, 'Resume build completed')
  }

  private failJob(jobId: string, errorMessage: string) {
    const job = linkedinImportJobs.get(jobId)
    if (!job) return
    job.status = 'failed'
    job.stage = 'failed'
    job.error = errorMessage
    job.updatedAt = nowIso()
    this.pushJobLog(jobId, `Failed: ${errorMessage}`)
  }

  private async runLinkedinImportJob(jobId: string) {
    const job = linkedinImportJobs.get(jobId)
    if (!job) return
    const { userId, linkedinUrl } = job
    this.setJobStage(jobId, 'starting', 'running')
    this.pushJobLog(jobId, 'Starting TinyFish LinkedIn import')

    try {
      const result = await this.executeLinkedinImport(userId, linkedinUrl, (msg) =>
        this.pushJobLog(jobId, msg),
      )
      this.completeJob(jobId, result)
    } catch (e: any) {
      this.failJob(jobId, e?.message || String(e))
    }
  }

  private async executeLinkedinImport(
    userId: string,
    linkedinUrl: string,
    log: (msg: string) => void,
  ): Promise<{ cvId: string; profileId: string | null }> {
    const linkedinStoragePath = `linkedin:${linkedinUrl}`

    const existingCv = await this.prisma.cV.findFirst({
      where: { userId, storagePath: linkedinStoragePath },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    })
    if (existingCv) {
      log('Using cached LinkedIn import')
      const existingProfile = await this.prisma.candidateProfile.findFirst({
        where: { userId, cvId: existingCv.id },
        orderBy: { createdAt: 'desc' },
      })
      return { cvId: existingCv.id, profileId: existingProfile?.id ?? null }
    }

    const goal = `Open this LinkedIn profile URL and extract candidate profile details.

Return STRICT JSON with this schema:
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
  "red_flags": [{"type": string, "note": string}],
  "resume_text": string|null,
  "raw_text": string|null,
  "unavailable_reason": string|null
}

Rules:
- Do not fabricate any missing information.
- If content cannot be accessed, set unavailable_reason with why.
- Confidence values must be in range 0..1.
`

    let result: any = null
    const attempts: Array<{ browser_profile: 'lite' | 'stealth'; proxy: boolean; label: string }> = [
      {
        browser_profile: LINKEDIN_BROWSER_PROFILE,
        proxy: LINKEDIN_PROXY_ENABLED,
        label: `${LINKEDIN_BROWSER_PROFILE}:${LINKEDIN_PROXY_ENABLED ? 'proxy' : 'direct'}`,
      },
    ]
    const needsFallback = LINKEDIN_BROWSER_PROFILE !== 'stealth' || !LINKEDIN_PROXY_ENABLED
    if (needsFallback) {
      attempts.push({
        browser_profile: 'stealth',
        proxy: true,
        label: 'stealth:proxy-fallback',
      })
    }

    let attemptLabel = attempts[0].label
    let lastError: any = null
    for (const attempt of attempts) {
      log(`Running TinyFish attempt (${attempt.label})`)
      try {
        const evt = await runTinyfish({
          url: linkedinUrl,
          goal,
          browser_profile: attempt.browser_profile,
          proxy_config: buildProxyConfig(attempt.proxy),
        })
        const normalized = normalizeResultJson(evt?.resultJson)
        if (normalized && typeof normalized === 'object') {
          result = normalized
          attemptLabel = attempt.label
          break
        }
        lastError = new Error('LinkedIn import returned an empty result payload')
      } catch (e: any) {
        lastError = e
      }
    }

    if (!result || typeof result !== 'object') {
      throw new ServiceUnavailableException({
        error: 'LinkedIn import is unavailable right now',
        details: lastError?.message || String(lastError || 'Unknown TinyFish error'),
        attempts: attempts.map((a) => a.label),
      })
    }

    log(`TinyFish extraction completed (${attemptLabel})`)
    const extractedText = buildExtractedTextFromLinkedinResult(result)
    const unavailableReason = String(result?.unavailable_reason || '').trim()
    if (!extractedText && unavailableReason) {
      throw new BadRequestException({
        error: 'Could not read LinkedIn profile content',
        details: unavailableReason,
      })
    }

    const fallbackWarning = unavailableReason || 'Generated from LinkedIn profile'
    const profileSeed = extractedText
      ? result
      : buildFallbackCandidateProfileFromCvText('', fallbackWarning)

    const normalizedLinks = {
      github: profileSeed?.links?.github ?? null,
      linkedin: profileSeed?.links?.linkedin ?? linkedinUrl,
      portfolio: profileSeed?.links?.portfolio ?? null,
    }

    const accessToken = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
    const host = (() => {
      try {
        return safeFilename(new URL(linkedinUrl).pathname.replaceAll('/', '_'))
      } catch {
        return 'linkedin_profile'
      }
    })()

    log('Saving CV record')
    const cv = await this.prisma.cV.create({
      data: {
        userId,
        filename: `LinkedIn_${host}.txt`,
        mimeType: 'text/x-linkedin-profile',
        sizeBytes: extractedText.length || null,
        storagePath: linkedinStoragePath,
        extractedText: extractedText || null,
        keywords: profileSeed?.keywords ?? null,
        accessToken,
      },
      select: {
        id: true,
      },
    })

    log('Creating candidate profile')
    const profile = await this.prisma.candidateProfile.create({
      data: {
        userId,
        cvId: cv.id,
        source: 'linkedin',
        status: 'ready',
        name: profileSeed?.name ?? null,
        titleHeadline: profileSeed?.title_headline ?? null,
        seniorityGuess: profileSeed?.seniority_guess ?? null,
        yearsExperienceGuess: profileSeed?.years_experience_guess ?? null,
        roles: profileSeed?.roles ?? null,
        skills: profileSeed?.skills ?? null,
        toolsStack: profileSeed?.tools_stack ?? null,
        industries: profileSeed?.industries ?? null,
        achievements: profileSeed?.achievements ?? null,
        education: profileSeed?.education ?? null,
        certifications: profileSeed?.certifications ?? null,
        keywords: profileSeed?.keywords ?? null,
        links: normalizedLinks,
        redFlags: profileSeed?.red_flags ?? null,
      },
      select: { id: true },
    })

    return { cvId: cv.id, profileId: profile.id }
  }
}
