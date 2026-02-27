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

## Environment
See `.env.example` for required variables.
