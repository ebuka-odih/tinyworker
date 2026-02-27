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
- GET `/api/cv`
- POST `/api/cv/upload`
- POST `/api/cv/import-linkedin`
- POST `/api/profile/extract/:cvId`
- PATCH `/api/profile/:profileId`
- POST `/api/tinyfish/run`
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

For LinkedIn profile import reliability, TinyFish is configured to use `stealth` profile and proxy by default:
- `TINYFISH_LINKEDIN_BROWSER_PROFILE` (`stealth` recommended)
- `TINYFISH_LINKEDIN_PROXY_ENABLED` (`true` recommended)
- `TINYFISH_LINKEDIN_PROXY_COUNTRY` (optional, e.g. `US`)
