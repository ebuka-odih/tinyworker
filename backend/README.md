# TinyWorker Backend (NestJS)

Backend API for TinyWorker (job discovery + CV profile extraction + tailoring workflows).

## What it does
- User auth (JWT)
- CV upload (PDF/DOCX)
- LinkedIn profile import to bootstrap CV/profile (via TinyFish)
- Profile extraction (PATH A):
  - Extract text locally (PDF via `pdftotext`, DOCX via `mammoth`)
  - Structure into CandidateProfile JSON using local parser by default
  - Optional: enable TinyFish structuring with `PROFILE_USE_TINYFISH=true`

## Setup

```bash
npm install
cp .env.example .env
# set DATABASE_URL and JWT_SECRET
npx prisma migrate dev
npm run start:dev
```

## Endpoints
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- GET `/api/billing/summary`
- POST `/api/billing/checkout-sessions`
- GET `/api/billing/customer-portal`
- POST `/api/billing/subscriptions/:id/cancel`
- POST `/api/billing/subscriptions/:id/resume`
- GET `/api/billing/paystack/callback`
- POST `/api/billing/webhooks/paystack`
- POST `/api/billing/webhooks/polar`
- GET `/api/cv`
- POST `/api/cv/upload`
- POST `/api/cv/import-linkedin` (starts async job)
- GET `/api/cv/import-linkedin/:jobId` (poll async job)
- POST `/api/profile/extract/:cvId`
- PATCH `/api/profile/:profileId`
- GET `/api/intent`
- PATCH `/api/intent`
- POST `/api/tinyfish/run`
- POST `/api/tinyfish/run-async`
- POST `/api/tinyfish/run-batch`
- GET `/api/tinyfish/runs/:runId`
- GET `/api/opportunities/search/jobs` (Valyu-backed public job search)
- GET `/api/opportunities`
- POST `/api/opportunities/import`
- GET `/api/applications`
- POST `/api/applications`
- PATCH `/api/applications/:id`
- GET `/api/documents`
- POST `/api/documents`
- DELETE `/api/documents/:id`
- POST `/api/telegram/webhook`
- GET `/api/telegram/tasks`
- POST `/api/telegram/report`
- PATCH `/api/telegram/tasks/:id`

## Environment
See `.env.example` for required variables.

Billing-specific configuration:
- `BILLING_ENABLED` enables quota enforcement and billing surfaces
- `BILLING_APP_BASE_URL` is the frontend base URL used for checkout success/cancel redirects
- `BILLING_API_BASE_URL` is the public backend base URL used for Paystack callbacks
- `FREE_DAILY_SEARCH_LIMIT` controls the free live-search quota
- `PAYSTACK_*` keys configure NGN weekly/monthly plans
- `POLAR_*` keys configure USD weekly/monthly products and webhook validation

For LinkedIn profile import reliability, TinyFish is configured to use `stealth` profile and proxy by default:
- `TINYFISH_LINKEDIN_BROWSER_PROFILE` (`stealth` recommended)
- `TINYFISH_LINKEDIN_PROXY_ENABLED` (`true` recommended)
- `TINYFISH_LINKEDIN_PROXY_COUNTRY` (optional, e.g. `US`)
