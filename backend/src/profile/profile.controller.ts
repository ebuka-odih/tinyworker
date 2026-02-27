import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { PrismaService } from '../prisma/prisma.service'
import { extractTextFromFile } from '../cv/text-extract'
import { extractCandidateProfileFromCvText } from './profile-extractor'

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
    if (!cv) return { error: 'CV not found' }

    // Extract text locally (cheap and reliable), then ask TinyFish to structure into JSON.
    const text = await extractTextFromFile(cv.storagePath, cv.mimeType || undefined)

    const result = await extractCandidateProfileFromCvText(text)

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

    return { ok: true, profile }
  }
}
