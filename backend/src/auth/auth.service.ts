import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { UsersService } from '../users/users.service'

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async register(params: { email: string; password: string; displayName?: string }) {
    const passwordHash = await bcrypt.hash(params.password, 12)
    const user = await this.users.createUser({
      email: params.email.toLowerCase().trim(),
      passwordHash,
      displayName: params.displayName,
    })

    return this.issueTokens(user.id, user.email)
  }

  async login(params: { email: string; password: string }) {
    const email = params.email.toLowerCase().trim()
    const user = await this.users.findByEmail(email)
    if (!user) throw new UnauthorizedException('Invalid email or password')

    const ok = await bcrypt.compare(params.password, user.passwordHash)
    if (!ok) throw new UnauthorizedException('Invalid email or password')

    return this.issueTokens(user.id, user.email)
  }

  issueTokens(userId: string, email: string) {
    const accessToken = this.jwt.sign({ sub: userId, email })
    return { accessToken }
  }
}
