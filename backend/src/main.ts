import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // For now allow local dev + same-host web. Lock down later.
  app.enableCors({ origin: true, credentials: true })
  app.setGlobalPrefix('api')

  // Health route without API prefix for external probes/reverse proxies.
  const expressApp = app.getHttpAdapter().getInstance()
  expressApp.get('/healthz', (_req: any, res: any) => res.json({ ok: true }))

  await app.listen(process.env.PORT ?? 4000)
}
bootstrap()
