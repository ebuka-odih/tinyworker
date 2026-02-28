# TinyWorker Phase Roadmap

## Current status
- Phase 1 (Profile intelligence): Implemented with backend extraction and profile review UI.
- Phase 2 (Guided questions): MVP implemented with `/api/intent` persistence + frontend wizard.
- Phase 3 (Job search): MVP implemented through TinyFish LinkedIn flow + persisted opportunities.
- Phase 4 (Tailored documents): Partial (document persistence implemented; generation quality still placeholder).

## Validation checklist
- Build
  - Frontend build passes (`npm run build`)
  - Backend build passes (`npm --prefix backend run build`)
- Endpoint smoke
  - Auth: register/login/me
  - CV: upload/list
  - Profile: extract/list/patch
  - TinyFish proxy: run
  - Opportunities: list/import
  - Applications: list/create/patch
  - Documents: list/create/delete
- Mobile smoke
  - Login form usable on mobile width
  - Dashboard cards do not overflow
  - Chat input stays accessible above bottom nav
  - Profile review editable fields are reachable and save works

## Validation run (2026-02-27)
- Frontend build
  - `npm run build` passed (`vite v6.4.1`, no warnings/errors).
- Backend build
  - `npm --prefix backend run build` passed after installing backend dependencies.
- Backend install notes
  - `npm --prefix backend install` completed with deprecation notices and 6 moderate vulnerabilities reported by npm audit.
- Endpoint smoke
  - Not executed in this run because no validated local Postgres + seeded auth flow was provided in task context.
  - Ready-to-run smoke endpoints are listed above and covered by implemented controllers.
- Mobile smoke
  - Manual checklist prepared; interactive browser/device verification not executed in this terminal-only pass.

## Validation run (2026-02-28)
- Full build
  - `npm run build` passed after adding CandidateIntent schema, intent API, and guided questions wizard route.
- Endpoint smoke
  - Not executed in this run because no validated local Postgres runtime session was configured for API calls.
- Mobile smoke
  - Not executed in this terminal-only pass.
