# TinyWorker — PROJECT_PLAN (MVP)

This is the product execution plan for TinyWorker.

## Goal
Build a web-based job discovery + CV tailoring workflow powered by TinyFish.

Users can:
- Upload CV (PDF/DOCX)
- Extract CandidateProfile (skills/roles/keywords)
- Guided questions (CandidateIntent)
- Search jobs (LinkedIn/Indeed first)
- Rank + shortlist jobs
- Tailor CV + generate cover letter per job

## Non-goals (MVP)
- Auto-apply (later, consent-gated)
- Logging into job boards

## Architecture
- Frontend: Vite/React (Opportunity Agent UI)
- Backend: NestJS (in `./backend/`) + Postgres + Prisma
- Automation: TinyFish (SSE API)

## Task format rules (swarm-ready)
- Each task has an ID: `T1`, `T2`, ...
- Each task declares `depends_on: []`
- Each task includes acceptance criteria + validation

---

## Tasks

### T1 — Backend: baseline run + env wiring
- depends_on: []
- owner: backend
- description:
  - Ensure `backend` can run with `.env` and connect to Postgres.
  - Provide a systemd service example (optional).
- files:
  - backend/.env.example
  - backend/README.md
- acceptance_criteria:
  - `pnpm start:dev` boots without crashing
  - `/auth/register` returns accessToken
- validation:
  - curl register + login
- done: false

### T2 — Legacy UI: switch CV upload to backend API
- depends_on: [T1]
- owner: frontend
- description:
  - Replace legacy local file-backed CV upload with backend endpoints:
    - POST /cv/upload
    - GET /cv
  - Store JWT in localStorage (minimal login modal in Settings)
- files:
  - src/App.tsx
  - src/services/*
- acceptance_criteria:
  - Upload CV works (pdf/docx)
  - CV list reflects backend
  - No 413 errors (nginx limit stays 25m)
- validation:
  - manual smoke on mobile
- done: false

### T3 — Profile extraction flow (PATH A)
- depends_on: [T1, T2]
- owner: backend+frontend
- description:
  - After CV upload, trigger POST /profile/extract/:cvId
  - Show extracted profile in UI (read-only for now)
- files:
  - backend/src/profile/*
  - src/App.tsx
- acceptance_criteria:
  - “Extract profile” works and persists
  - UI renders keywords + skills + roles
- validation:
  - curl extract + UI smoke
- done: false

### T4 — Guided questions (CandidateIntent)
- depends_on: [T3]
- owner: frontend
- description:
  - Convert Agent view into wizard-style steps (not generic chat)
  - Store answers locally; later persist
- acceptance_criteria:
  - Stepper UI works on mobile
  - Generates CandidateIntent object
- done: false

### T5 — Job search (LinkedIn/Indeed public)
- depends_on: [T3, T4]
- owner: backend
- description:
  - Use TinyFish to search jobs from CandidateProfile/Intent
  - Return normalized Job cards with match reasons
- done: false

