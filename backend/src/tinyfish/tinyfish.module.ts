import { Module } from '@nestjs/common'
import { TinyfishController } from './tinyfish.controller'

@Module({
  controllers: [TinyfishController],
})
export class TinyfishModule {}

