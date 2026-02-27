import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { PrismaService } from '../prisma/prisma.service'
import { extractTextFromFile } from '../cv/text-extract'
import {
  buildFallbackCandidateProfileFromCvText,
  extractCandidateProfileFromCvText,
} from './profile-extractor'

const USE_TINYFISH_FOR_PROFILE_EXTRACTION = /^(1|true|yes)$/i.test(
  String(process.env.PROFILE_USE_TINYFISH || ''),
)

function appendWarning(current: string | null, next: string): string {
  return current ? `${current}; ${next}` : next
}

const UpdateProfileSchema = z.object({
  preferredRoles: z.array(z.string().min(1)).optional(),
  preferredLocations: z.array(z.string().min(1)).optional(),
  links: z
    .object({
      github: z.string().optional().nullable(),
      linkedin: z.string().optional().nullable(),
      portfolio: z.string().optional().nullable(),
    })
    .optional(),
})

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any) {
    const userId = req.user.userId as string
    const profiles = await this.prisma.candidateProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return { profiles }
  }

  @Post('extract/:cvId')
  async extractFromCv(@Param('cvId') cvId: string, @Req() req: any) {
    const userId = req.user.userId as string

    const cv = await this.prisma.cV.findFirst({ where: { id: cvId, userId } })
    if (!cv) throw new NotFoundException('CV not found')

    const existingProfile = await this.prisma.candidateProfile.findFirst({
      where: { userId, cvId: cv.id },
      orderBy: { createdAt: 'desc' },
    })
    if (existingProfile) {
      return {
        ok: true,
        profile: existingProfile,
        extraction: {
          method: 'cached',
          warning: null,
        },
      }
    }

    // Prefer cached text (durable in DB) to avoid depending on ephemeral container files.
    let text = String(cv.extractedText || '').trim()
    let sourceWarning: string | null = null
    if (!text) {
      try {
        text = await extractTextFromFile(cv.storagePath, cv.mimeType || undefined)
      } catch (e: any) {
        const missingFile =
          e?.code === 'ENOENT' || String(e?.message || '').includes('no such file or directory')
        if (missingFile) {
          sourceWarning =
            'CV source file is no longer available on server; generated a minimal fallback profile'
        } else {
          throw new BadRequestException({
            error: 'Failed to extract text from CV',
            details: e?.message || String(e),
          })
        }
      }
    }

    let result: any = null
    let extractionMethod: 'tinyfish' | 'fallback' | 'cached' = 'tinyfish'
    let extractionWarning: string | null = sourceWarning

    if (!text) {
      extractionMethod = 'fallback'
      extractionWarning = appendWarning(extractionWarning, 'No CV text available for deep extraction')
      result = buildFallbackCandidateProfileFromCvText('', extractionWarning)
    } else if (USE_TINYFISH_FOR_PROFILE_EXTRACTION) {
      try {
        result = await extractCandidateProfileFromCvText(text)
        if (!result || typeof result !== 'object') {
          extractionMethod = 'fallback'
          extractionWarning = appendWarning(extractionWarning, 'TinyFish returned an empty profile payload')
          result = buildFallbackCandidateProfileFromCvText(text, extractionWarning)
        }
      } catch (e: any) {
        extractionMethod = 'fallback'
        extractionWarning = appendWarning(
          extractionWarning,
          e?.message || 'TinyFish extraction failed',
        )
        result = buildFallbackCandidateProfileFromCvText(text, extractionWarning)
      }
    } else {
      extractionMethod = 'fallback'
      extractionWarning = appendWarning(
        extractionWarning,
        'TinyFish extraction disabled; using local parser',
      )
      result = buildFallbackCandidateProfileFromCvText(text, extractionWarning)
    }

    const profile = await this.prisma.candidateProfile.create({
      data: {
        userId,
        cvId: cv.id,
        source: 'cv',
        status: 'ready',
        name: result?.name ?? null,
        titleHeadline: result?.title_headline ?? null,
        seniorityGuess: result?.seniority_guess ?? null,
        yearsExperienceGuess: result?.years_experience_guess ?? null,
        roles: result?.roles ?? null,
        skills: result?.skills ?? null,
        toolsStack: result?.tools_stack ?? null,
        industries: result?.industries ?? null,
        achievements: result?.achievements ?? null,
        education: result?.education ?? null,
        certifications: result?.certifications ?? null,
        keywords: result?.keywords ?? null,
        links: result?.links ?? null,
        redFlags: result?.red_flags ?? null,
      },
    })

    // Store extractedText + keywords on CV for reuse.
    await this.prisma.cV.update({
      where: { id: cv.id },
      data: {
        extractedText: text,
        keywords: result?.keywords ?? null,
      },
    })

    return {
      ok: true,
      profile,
      extraction: {
        method: extractionMethod,
        warning: extractionWarning,
      },
    }
  }

  @Patch(':profileId')
  async updateProfile(@Param('profileId') profileId: string, @Req() req: any, @Body() body: any) {
    const userId = req.user.userId as string
    const existing = await this.prisma.candidateProfile.findFirst({ where: { id: profileId, userId } })
    if (!existing) throw new NotFoundException('Profile not found')

    let data: z.infer<typeof UpdateProfileSchema>
    try {
      data = UpdateProfileSchema.parse(body || {})
    } catch (e: any) {
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }

    const updated = await this.prisma.candidateProfile.update({
      where: { id: profileId },
      data: {
        preferredRoles: data.preferredRoles ?? undefined,
        preferredLocations: data.preferredLocations ?? undefined,
        links: data.links ?? undefined,
      },
    })

    return { ok: true, profile: updated }
  }
}
