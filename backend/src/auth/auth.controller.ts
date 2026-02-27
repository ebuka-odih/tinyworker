import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt.guard'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(64).optional(),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    try {
      const data = RegisterSchema.parse(body)
      return this.auth.register(data)
    } catch (e: any) {
      // Return 400 instead of generic 500 for validation errors
      throw new BadRequestException({ error: 'Invalid input', details: e?.issues || e?.message })
    }
  }

  @Post('login')
  async login(@Body() body: any) {
    const data = LoginSchema.parse(body)
    return this.auth.login(data)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return { user: req.user }
  }
}
