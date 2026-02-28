# TinyWorker Phase Roadmap

## Current status
- Phase 1 (Profile intelligence): Implemented with backend extraction and profile review UI.
- Phase 2 (Agent chat with real data): Planned (backend chat APIs + orchestration + frontend integration not yet implemented).
- Phase 2 prerequisite (Guided questions): MVP implemented with `/api/intent` persistence + frontend wizard.
- Phase 3 (Job search): MVP implemented through TinyFish LinkedIn flow + persisted opportunities.
- Phase 4 (Tailored documents): Partial (document persistence implemented; generation quality still placeholder).

## Phase 2 execution plan (Agent chat with real data)
- P2.1 Backend chat persistence
  - Add chat session/message schema + `/api/chat/*` endpoints.
- P2.2 Backend chat orchestration
  - Move branching logic from frontend to backend service.
  - Use profile + intent context and persist opportunity results.
- P2.3 Frontend chat API migration
  - Replace scripted local flow in `ChatView` with API-backed message history.
- P2.4 Chat action wiring
  - Save opportunity / create application actions directly from chat results.
- P2.5 Reliability + cost controls
  - Add throttling, structured logging, and graceful failure handling.
- P2.6 Validation
  - Build + endpoint smoke + mobile chat layout verification.

## Phase 2 flow parity spec (source: TinyFish Telegram handlers)

### Jobs flow (11 steps)
| Step | Key | Prompt intent |
|---|---|---|
| 1 | `job_level` | Role level |
| 2 | `job_title` | Title keywords (pick or manual text) |
| 3 | `job_focus` | Industry/field (pick/any/manual) |
| 4 | `job_location` | Country (pick or manual text) |
| 5 | `job_mode` | Remote/hybrid/onsite |
| 6 | `job_source` | Preferred source |
| 7 | `job_stack` | Skills/tools (pick/skip/manual) |
| 8 | `job_visa` | Sponsorship yes/no/skip |
| 9 | `job_salary` | Salary band (pick/skip/manual) |
| 10 | `job_company` | Startup/enterprise/any |
| 11 | `review` | Actions: Run search / Edit / Save & monitor |

### Scholarships flow (10 steps)
| Step | Key | Prompt intent |
|---|---|---|
| 1 | `sch_level` | Study level (Masters/PhD/etc.) |
| 2 | `sch_country` or `sch_country_manual` | Destination country |
| 3 | `sch_field` | Field/program keywords (pick or manual) |
| 4 | `sch_funding` | Full/partial/any |
| 5 | `sch_tuition` | Tuition preference |
| 6 | `sch_intake` | Intake season |
| 7 | `sch_year` | Intake year (pick or manual) |
| 8 | `sch_eligibility_text` | Eligibility notes/quick option |
| 9 | `sch_deadline` | Deadline urgency |
| 10 | `review` | Actions: Run search / Edit / Save & monitor |

### Manual text-accepted steps
- Scholarships: `sch_country`, `sch_country_manual`, `sch_field`, `sch_year`, `sch_eligibility_text`
- Jobs: `job_title`, `job_focus`, `job_location`, `job_stack`, `job_salary`

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
