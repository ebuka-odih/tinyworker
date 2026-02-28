import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { PrismaModule } from './prisma/prisma.module'
import { UsersModule } from './users/users.module'
import { AuthModule } from './auth/auth.module'
import { CvModule } from './cv/cv.module'
import { ProfileModule } from './profile/profile.module'
import { TinyfishModule } from './tinyfish/tinyfish.module'
import { OpportunitiesModule } from './opportunities/opportunities.module'
import { ApplicationsModule } from './applications/applications.module'
import { DocumentsModule } from './documents/documents.module'
import { TelegramModule } from './telegram/telegram.module'
import { IntentModule } from './intent/intent.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    CvModule,
    ProfileModule,
    TinyfishModule,
    OpportunitiesModule,
    ApplicationsModule,
    DocumentsModule,
    TelegramModule,
    IntentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
