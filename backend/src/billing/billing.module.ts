import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { BillingController } from './billing.controller'
import { BillingService } from './billing.service'
import { PaystackProvider } from './paystack.provider'
import { PolarProvider } from './polar.provider'
import { SearchQuotaService } from './search-quota.service'

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService, SearchQuotaService, PaystackProvider, PolarProvider],
  exports: [BillingService, SearchQuotaService],
})
export class BillingModule {}
