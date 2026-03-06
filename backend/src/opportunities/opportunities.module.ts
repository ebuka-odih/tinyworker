import { Module } from '@nestjs/common'
import { OpportunitiesController } from './opportunities.controller'
import { ValyuSearchService } from './valyu-search.service'
import { JobSearchOrchestrator } from './job-search.orchestrator'
import { JobSearchRunStore } from './job-search-run.store'

@Module({
  controllers: [OpportunitiesController],
  providers: [ValyuSearchService, JobSearchRunStore, JobSearchOrchestrator],
})
export class OpportunitiesModule {}
