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
- Task IDs: `T1` ... `T13`
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
  - frontend/vite.config.ts
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
  - frontend/src/App.tsx
  - frontend/src/types.ts
  - frontend/src/services/tinyfishService.ts
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
  - frontend/src/App.tsx
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
  - frontend/src/App.tsx
- acceptance_criteria:
  - Search results can be persisted as opportunities
  - Saved applications are visible in pipeline views
  - Documents load from backend and support delete
- validation:
  - `npm --prefix backend run build`
  - `npm run build`
- done: true

### T7 — Phase 2 guided intent flow
- depends_on: [T2]
- owner: frontend,backend
- description:
  - Add CandidateIntent persistence in backend with authenticated API endpoints.
  - Add guided questions wizard in frontend with step state and draft/final saves.
- files:
  - backend/prisma/schema.prisma
  - backend/prisma/migrations/*
  - backend/src/intent/*
  - backend/src/app.module.ts
  - frontend/src/components/app/views/GuidedQuestionsView.tsx
  - frontend/src/components/app/views/DashboardView.tsx
  - frontend/src/App.tsx
  - frontend/src/types.ts
- acceptance_criteria:
  - User can open guided questions flow from dashboard
  - Intent responses persist via `/api/intent`
  - Wizard supports draft and ready states
- validation:
  - `npm run build`
- done: true

### T8 — Phase 2A chat domain model + APIs
- depends_on: [T2, T5, T7]
- owner: backend
- description:
  - Add persistent chat session/message models and APIs.
  - Keep all chat data scoped per authenticated user.
  - Support typed assistant messages (`text`, `options`, `results`, `progress`) from API.
- files:
  - backend/prisma/schema.prisma
  - backend/prisma/migrations/*
  - backend/src/chat/*
  - backend/src/app.module.ts
- acceptance_criteria:
  - User can create/list chat sessions
  - User messages and assistant messages persist and can be reloaded
  - API returns normalized message payload shape for frontend rendering
- validation:
  - `npm --prefix backend run build`
  - curl smoke for `/api/chat/*`
- done: false

### T9 — Phase 2B chat orchestrator with real sources
- depends_on: [T8]
- owner: backend
- description:
  - Build server-side chat orchestration that uses persisted profile + intent context.
  - For jobs flow, call TinyFish through backend and persist opportunities from results.
  - Add graceful fallback when TinyFish is unavailable.
  - Match Telegram flow parity for jobs and scholarships step sequencing (`job_level...review`, `sch_level...review`).
- files:
  - backend/src/chat/*
  - backend/src/tinyfish/*
  - backend/src/opportunities/*
- acceptance_criteria:
  - Chat replies are generated from backend logic, not hardcoded frontend branches
  - Job-search turns can produce persisted opportunities linked to current user
  - Failure mode returns user-safe assistant error message without crashing chat
  - Flow engine supports manual text input on parity steps (jobs: title/focus/location/stack/salary; scholarships: country/field/year/eligibility)
- validation:
  - `npm --prefix backend run build`
  - endpoint smoke for success and TinyFish-failure paths
- done: false

### T10 — Phase 2C frontend chat real-data integration
- depends_on: [T8, T9]
- owner: frontend
- description:
  - Replace local scripted flow in `ChatView` with API-backed session/messages.
  - Load chat history on route open and append optimistic user messages.
  - Render server-provided options/results/progress message types.
  - Render step progress in UI as `Step X/Y` according to backend flow metadata.
- files:
  - frontend/src/components/app/views/ChatView.tsx
  - frontend/src/App.tsx
  - frontend/src/types.ts
  - frontend/src/services/*
- acceptance_criteria:
  - Reloading `/chat` restores session history from backend
  - Sending free text/options posts to backend and shows API reply
  - No hardcoded job/scholarship branching remains in frontend
  - Manual text entry works on parity-defined manual steps without breaking flow state
- validation:
  - `npm run build`
  - manual smoke: open chat -> send message -> reload page -> history persists
- done: false

### T11 — Phase 2D chat action wiring to pipeline
- depends_on: [T10]
- owner: frontend,backend
- description:
  - Wire chat result actions to persisted pipeline actions.
  - Add explicit actions from chat cards: save opportunity, create application, open details.
  - Keep idempotency safeguards to prevent duplicate imports/actions.
- files:
  - backend/src/chat/*
  - backend/src/opportunities/*
  - backend/src/applications/*
  - frontend/src/components/app/views/ChatView.tsx
  - frontend/src/App.tsx
- acceptance_criteria:
  - “Save” from chat result is reflected in opportunities/applications views
  - Duplicate clicks do not create duplicate records
  - Chat-to-dashboard navigation shows consistent persisted state
- validation:
  - `npm --prefix backend run build`
  - `npm run build`
- done: false

### T12 — Phase 2E observability + rate-limit safeguards
- depends_on: [T9]
- owner: backend
- description:
  - Add structured chat logs for request/response lifecycle (without secrets/PII leakage).
  - Add per-user throttle on chat search triggers to control TinyFish spend.
  - Capture failure counters to simplify operational debugging.
- files:
  - backend/src/chat/*
  - backend/src/tinyfish/*
- acceptance_criteria:
  - Chat requests include traceable request IDs in logs
  - Rate-limit response is explicit and user-friendly
  - Error telemetry captures upstream failure reason class
- validation:
  - `npm --prefix backend run build`
  - manual smoke for throttle behavior
- done: false

### T13 — Phase 2 validation gates
- depends_on: [T8, T9, T10, T11, T12]
- owner: qa
- description:
  - Run integrated build and smoke checks for the new chat flow.
  - Verify mobile behavior for long threads and bottom input stability.
- files:
  - docs/plans/phase-roadmap.md
- acceptance_criteria:
  - Build and smoke commands executed or blockers recorded
  - Chat flow tested for message persistence and pipeline actions
- validation:
  - `npm run build`
  - API smoke for `/api/chat/*`
  - mobile smoke checklist for `/chat`
- done: false

### T6 — Validation gates
- depends_on: [T1, T2, T3, T5, T7]
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
