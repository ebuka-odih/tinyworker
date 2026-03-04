import { Module } from '@nestjs/common'
import { OpportunitiesController } from './opportunities.controller'
import { ValyuSearchService } from './valyu-search.service'

@Module({
  controllers: [OpportunitiesController],
  providers: [ValyuSearchService],
})
export class OpportunitiesModule {}
