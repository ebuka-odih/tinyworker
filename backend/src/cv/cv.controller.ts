import {
  Controller,
  Get,
  Post,
  Req,
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

import { JwtAuthGuard } from '../auth/jwt.guard'
import { PrismaService } from '../prisma/prisma.service'
import { extractTextFromFile } from './text-extract'

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true })
}

const UPLOAD_ROOT = process.env.CV_UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads')

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
}
