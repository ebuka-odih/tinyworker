# TinyWorker

TinyWorker is a web app for **job discovery and CV tailoring** powered by **TinyFish**.

It helps users:
- Upload a CV (PDF/DOCX)
- Extract a structured **Candidate Profile** (skills, roles, keywords)
- Search and shortlist relevant jobs
- Generate job-specific tailored documents (CV + cover letter)

> Auto-apply is planned, but will remain behind a strict consent/safety gate.

## Repo structure

- `./frontend/` — Frontend (Opportunity Agent UI, Vercel target)
- `./backend/` — Backend API (NestJS + Postgres + Prisma)

## Local development

### Full stack (recommended)

```bash
npm --prefix frontend install
npm --prefix backend install
npm run dev
```

`npm run dev` now runs:
- Frontend on `http://localhost:3000`
- Backend API (Nest) on `http://localhost:4000`

### Frontend only

See: [`frontend/.env.example`](frontend/.env.example)

```bash
cd frontend
npm install
npm run dev
```

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

## Deployment folder targets

- Vercel frontend project root: `frontend/`
- Backend project root: `backend/`

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
- `POST /api/telegram/webhook`
- `GET /api/telegram/tasks`
- `POST /api/telegram/report`
- `PATCH /api/telegram/tasks/:id`

## Notes
- The backend uses a cost-efficient approach for CV processing:
  - Convert PDF/DOCX → text locally
  - Use TinyFish to structure the text into CandidateProfile JSON

## Telegram task bot
- Configure `TELEGRAM_BOT_TOKEN` in `backend/.env`.
- Optional but recommended:
  - `TELEGRAM_WEBHOOK_SECRET` for webhook verification.
  - `TELEGRAM_DEFAULT_CHAT_ID` for report delivery target.
  - `TELEGRAM_ALLOWED_CHAT_IDS` (comma separated) to allowlist inbound chats.
- Register webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<your-domain>/api/telegram/webhook","secret_token":"<your-webhook-secret>"}'
```

- Telegram commands:
  - `/task <text>` create a task
  - `/tasks` list open tasks
  - `/done <task-id-prefix>` mark done
  - Plain text messages are also saved as open tasks.
