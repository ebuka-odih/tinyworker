# TinyWorker backend (NestJS)

Backend has been imported from the TinyFinder monorepo into `./backend/`.

## Run (dev)

```bash
cd backend
cp .env.example .env
# set DATABASE_URL + JWT_SECRET
npm install
npx prisma migrate dev
npm run start:dev
```

## Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET /api/cv
- POST /api/cv/upload
- POST /api/profile/extract/:cvId (PATH A: pdf/docx -> text locally -> TinyFish structures JSON)
- PATCH /api/profile/:profileId
- POST /api/tinyfish/run
- GET /api/opportunities
- POST /api/opportunities/import
- GET /api/applications
- POST /api/applications
- PATCH /api/applications/:id
- GET /api/documents
- POST /api/documents
- DELETE /api/documents/:id
