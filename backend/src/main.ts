import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // For now allow local dev + same-host web. Lock down later.
  app.enableCors({ origin: true, credentials: true })

  await app.listen(process.env.PORT ?? 4000)
}
bootstrap()
