import { Module } from '@nestjs/common'
import { IntentController } from './intent.controller'

@Module({
  controllers: [IntentController],
})
export class IntentModule {}
