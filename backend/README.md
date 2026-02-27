# TinyWorker Backend (NestJS)

Backend API for TinyWorker (job discovery + CV profile extraction + tailoring workflows).

## What it does
- User auth (JWT)
- CV upload (PDF/DOCX)
- Profile extraction (PATH A):
  - Extract text locally (PDF via `pdftotext`, DOCX via `mammoth`)
  - Use TinyFish to structure into a CandidateProfile JSON (skills/roles/keywords)

## Setup

```bash
pnpm install
cp .env.example .env
# set DATABASE_URL and JWT_SECRET
pnpm prisma migrate dev
pnpm start:dev
```

## Endpoints
- POST `/auth/register`
- POST `/auth/login`
- GET `/auth/me`
- GET `/cv`
- POST `/cv/upload`
- POST `/profile/extract/:cvId`

## Environment
See `.env.example` for required variables.
