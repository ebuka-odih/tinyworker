# TinyWorker backend (NestJS)

Backend has been imported from the TinyFinder monorepo into `./backend/`.

## Run (dev)

```bash
cd backend
cp .env.example .env
# set DATABASE_URL + JWT_SECRET
pnpm install
pnpm prisma migrate dev
pnpm start:dev
```

## Endpoints
- POST /auth/register
- POST /auth/login
- GET /auth/me
- GET /cv
- POST /cv/upload
- POST /profile/extract/:cvId (PATH A: pdf/docx -> text locally -> TinyFish structures JSON)
