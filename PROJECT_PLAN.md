# TinyWorker Project Plan

## Project
- Name: TinyWorker
- Goal: Deliver a unified, production-ready CV intelligence flow (auth -> CV upload -> profile extraction/review -> opportunity tracking)
- Non-goals:
  - Full auto-apply
  - Full scholarship/visa search production integrations
- Constraints:
  - Keep API consolidated under NestJS `/api/*`
  - Preserve mobile-friendly frontend behavior
  - Keep TinyFish integration proxied through backend

## Dependency graph rules
- Task IDs: `T1` ... `T6`
- Every task declares `depends_on`
- Only run blocked tasks after dependencies are complete

## Tasks

### T1 — Unify backend architecture on Nest
- depends_on: []
- owner: backend
- description:
  - Use Nest as source-of-truth API with `/api` prefix.
  - Stop root dev flow from depending on legacy Express API.
- files:
  - backend/src/main.ts
  - package.json
  - vite.config.ts
  - README.md
  - README_BACKEND.md
  - backend/README.md
- acceptance_criteria:
  - Frontend dev proxy points to Nest backend
  - Backend serves `/api/*` endpoints
- validation:
  - `npm --prefix backend run build`
- done: true

### T2 — Frontend auth integration
- depends_on: [T1]
- owner: frontend
- description:
  - Add login/register flow and JWT persistence.
  - Add auth headers to protected API calls.
  - Protect dashboard/chat/documents/applications routes.
- files:
  - src/App.tsx
  - src/types.ts
  - src/services/tinyfishService.ts
- acceptance_criteria:
  - User can register/login and access protected screens
  - Token is reused across refreshes
- validation:
  - `npm run build`
- done: true

### T3 — Phase 1 profile flow (extract + review)
- depends_on: [T2]
- owner: frontend,backend
- description:
  - Extract candidate profile from CV.
  - Add profile review page with editable preferences.
  - Persist edits via API.
- files:
  - backend/src/profile/profile.controller.ts
  - src/App.tsx
- acceptance_criteria:
  - Upload CV -> extract profile -> review profile works
  - preferred roles/locations/links save
- validation:
  - curl smoke for profile extract + patch
- done: true

### T4 — Durable planning artifacts
- depends_on: []
- owner: orchestrator
- description:
  - Maintain primary project plan and phase plan docs in repo.
- files:
  - PROJECT_PLAN.md
  - docs/plans/phase-roadmap.md
- acceptance_criteria:
  - Plan exists and tracks completion status
- validation:
  - file presence in repo
- done: true

### T5 — Replace mock dashboard data with persisted APIs
- depends_on: [T2, T3]
- owner: frontend,backend
- description:
  - Add DB models + APIs for opportunities, applications, documents.
  - Bind dashboard/applications/documents views to persisted data.
- files:
  - backend/prisma/schema.prisma
  - backend/prisma/migrations/*
  - backend/src/opportunities/*
  - backend/src/applications/*
  - backend/src/documents/*
  - backend/src/app.module.ts
  - src/App.tsx
- acceptance_criteria:
  - Search results can be persisted as opportunities
  - Saved applications are visible in pipeline views
  - Documents load from backend and support delete
- validation:
  - `npm --prefix backend run build`
  - `npm run build`
- done: true

### T6 — Validation gates
- depends_on: [T1, T2, T3, T5]
- owner: qa
- description:
  - Run build/smoke checks and document mobile smoke checklist.
- files:
  - docs/plans/phase-roadmap.md
- acceptance_criteria:
  - Build and smoke commands executed or blockers recorded
- validation:
  - command output + checklist
- done: true
