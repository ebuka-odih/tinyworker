import { Module } from '@nestjs/common'
import { BillingModule } from '../billing/billing.module'
import { OpportunitiesController } from './opportunities.controller'
import { ValyuSearchService } from './valyu-search.service'
import { JobSearchOrchestrator } from './job-search.orchestrator'
import { JobSearchRunStore } from './job-search-run.store'
import { ScholarshipSearchOrchestrator } from './scholarship-search.orchestrator'
import { GrantSearchOrchestrator } from './grant-search.orchestrator'
import { VisaSearchOrchestrator } from './visa-search.orchestrator'

@Module({
  imports: [BillingModule],
  controllers: [OpportunitiesController],
  providers: [
    ValyuSearchService,
    JobSearchRunStore,
    JobSearchOrchestrator,
    ScholarshipSearchOrchestrator,
    GrantSearchOrchestrator,
    VisaSearchOrchestrator,
  ],
})
export class OpportunitiesModule {}
