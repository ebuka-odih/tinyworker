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

### Full stack (recommended)

```bash
npm install
npm --prefix backend install
npm run dev
```

`npm run dev` now runs:
- Frontend on `http://localhost:3000`
- Backend API (Nest) on `http://localhost:4000`

### Backend only

See: [`backend/.env.example`](backend/.env.example)

```bash
cd backend
npm install
cp .env.example .env
# set DATABASE_URL + JWT_SECRET
npx prisma migrate dev
npm run start:dev
```

## Key endpoints (backend)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/cv`
- `POST /api/cv/upload`
- `POST /api/profile/extract/:cvId`
- `PATCH /api/profile/:profileId`
- `POST /api/tinyfish/run`
- `GET /api/opportunities`
- `POST /api/opportunities/import`
- `GET /api/applications`
- `POST /api/applications`
- `PATCH /api/applications/:id`
- `GET /api/documents`
- `POST /api/documents`
- `DELETE /api/documents/:id`

## Notes
- The backend uses a cost-efficient approach for CV processing:
  - Convert PDF/DOCX → text locally
  - Use TinyFish to structure the text into CandidateProfile JSON
