import * as path from 'node:path'
import * as fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import mammoth from 'mammoth'

const execFileAsync = promisify(execFile)

export async function extractTextFromFile(filePath: string, mimeType?: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    // pdftotext is installed via poppler-utils
    const { stdout } = await execFileAsync('pdftotext', ['-layout', filePath, '-'])
    return String(stdout || '').trim()
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const buf = fs.readFileSync(filePath)
    const res = await mammoth.extractRawText({ buffer: buf })
    return String(res.value || '').trim()
  }

  throw new Error('Unsupported file type for text extraction')
}
