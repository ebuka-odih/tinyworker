# TinyWorker

TinyWorker is a web app for **job discovery and CV tailoring** powered by **TinyFish**.

It helps users:
- Upload a CV (PDF/DOCX)
- Extract a structured **Candidate Profile** (skills, roles, keywords)
- Search and shortlist relevant jobs
- Generate job-specific tailored documents (CV + cover letter)

> Auto-apply is planned, but will remain behind a strict consent/safety gate.

## Repo structure

- `./` — Frontend (Opportunity Agent UI)
- `./backend/` — Backend API (NestJS + Postgres + Prisma)

## Local development

### Frontend

```bash
pnpm install
pnpm dev
```

### Backend

See: [`backend/.env.example`](backend/.env.example)

```bash
cd backend
pnpm install
cp .env.example .env
# set DATABASE_URL + JWT_SECRET
pnpm prisma migrate dev
pnpm start:dev
```

## Key endpoints (backend)
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /cv`
- `POST /cv/upload`
- `POST /profile/extract/:cvId`

## Notes
- The backend uses a cost-efficient approach for CV processing:
  - Convert PDF/DOCX → text locally
  - Use TinyFish to structure the text into CandidateProfile JSON
