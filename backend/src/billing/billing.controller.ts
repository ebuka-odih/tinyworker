import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { BillingService } from './billing.service'

const CheckoutSchema = z.object({
  planKey: z.enum(['pro_weekly', 'pro_monthly']),
  currency: z.enum(['NGN', 'USD']),
})

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  async summary(@Req() req: any) {
    return await this.billing.getBillingSummary(req.user.userId as string)
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout-sessions')
  async createCheckoutSession(@Req() req: any, @Body() body: any) {
    const parsed = CheckoutSchema.safeParse(body || {})
    if (!parsed.success) {
      throw new BadRequestException({ error: 'Invalid checkout payload', details: parsed.error.issues })
    }

    return await this.billing.createCheckoutSession(req.user.userId as string, req.user.email as string, parsed.data)
  }

  @UseGuards(JwtAuthGuard)
  @Get('customer-portal')
  async customerPortal(@Req() req: any) {
    return await this.billing.getCustomerPortalUrl(req.user.userId as string)
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions/:id/cancel')
  async cancelSubscription(@Req() req: any, @Param('id') id: string) {
    return await this.billing.cancelSubscription(req.user.userId as string, id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions/:id/resume')
  async resumeSubscription(@Req() req: any, @Param('id') id: string) {
    return await this.billing.resumeSubscription(req.user.userId as string, id)
  }

  @Get('paystack/callback')
  async paystackCallback(@Query('reference') reference: string, @Res() res: Response) {
    const redirectUrl = await this.billing.handlePaystackCallback(String(reference || '').trim())
    return res.redirect(redirectUrl)
  }

  @Post('webhooks/paystack')
  async paystackWebhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-paystack-signature') signature?: string) {
    return await this.billing.handlePaystackWebhook(req.rawBody || Buffer.from(JSON.stringify(req.body || {})), signature, req.body || {})
  }

  @Post('webhooks/polar')
  async polarWebhook(@Req() req: Request & { rawBody?: Buffer }) {
    return await this.billing.handlePolarWebhook(req.rawBody || Buffer.from(JSON.stringify(req.body || {})), req.headers as Record<string, any>)
  }
}
