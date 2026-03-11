import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { validateEvent } from '@polar-sh/sdk/webhooks'

type PolarCheckoutInput = {
  productId: string
  externalCustomerId: string
  customerEmail: string
  successUrl: string
  returnUrl: string
  metadata: Record<string, any>
}

@Injectable()
export class PolarProvider {
  constructor(private readonly config: ConfigService) {}

  private get accessToken() {
    const value = String(this.config.get<string>('POLAR_ACCESS_TOKEN') || '').trim()
    if (!value) {
      throw new ServiceUnavailableException('Polar is not configured')
    }
    return value
  }

  private get webhookSecret() {
    return String(this.config.get<string>('POLAR_WEBHOOK_SECRET') || '').trim()
  }

  private get baseUrl() {
    const server = String(this.config.get<string>('POLAR_SERVER') || 'production').trim().toLowerCase()
    return server === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh'
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })

    const raw = await response.text().catch(() => '')
    const payload = raw ? JSON.parse(raw) : {}
    if (!response.ok) {
      throw new Error(payload?.detail || payload?.message || `Polar request failed (${response.status})`)
    }

    return payload as T
  }

  async createCheckout(input: PolarCheckoutInput) {
    return await this.request<{
      id: string
      url: string
      customer?: {
        id?: string
        external_id?: string
      }
    }>('/v1/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        products: [input.productId],
        external_customer_id: input.externalCustomerId,
        customer_email: input.customerEmail,
        success_url: input.successUrl,
        return_url: input.returnUrl,
        metadata: input.metadata,
      }),
    })
  }

  async createCustomerPortal(externalCustomerId: string) {
    return await this.request<{
      id: string
      customer_portal_url: string
      customer?: {
        id?: string
      }
    }>('/v1/customer-sessions', {
      method: 'POST',
      body: JSON.stringify({
        external_customer_id: externalCustomerId,
      }),
    })
  }

  validateWebhookEvent(rawBody: Buffer, headers: Record<string, any>) {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException('Polar webhook secret is not configured')
    }

    return validateEvent(rawBody, headers, this.webhookSecret) as Record<string, any>
  }
}
