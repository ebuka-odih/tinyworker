# TinyWorker

TinyWorker is an AI-assisted opportunity discovery platform. In the current product surface, the user-facing app is branded as **TinyFinder** and helps people search for **jobs, scholarships, grants, and visa pathways** through guided flows instead of manual tab-hopping.

At a product level, the system is built to:
- let users create an account and maintain a private search workspace
- collect search intent through structured intake flows
- run live searches against trusted public sources
- enrich shortlisted results with extraction pipelines
- save opportunities, track applications, and persist search history
- upload a CV and derive a reusable candidate profile for future matching
- gate premium search volume behind billing and daily search quotas

## What the project does

TinyWorker combines a frontend search workspace with a backend orchestration API.

For a typical user flow:
1. The user signs in and chooses a search type: job, scholarship, grant, or visa.
2. The app collects criteria such as role focus, location, remote preference, destination region, applicant type, or visa context.
3. The backend runs a live discovery process against public web sources.
4. For searches that require deeper extraction, the backend enriches shortlisted links using TinyFish and normalizes them into structured results.
5. The frontend streams progress, shows queued and completed items, and stores sessions so the user can resume later.
6. The user can save opportunities, manage applications, update profile preferences, and access billing controls when quotas apply.

This makes the project more than a simple job board UI. It is an orchestrated search product with user auth, data persistence, live result streaming, CV/profile processing, and monetization support.

## Core capabilities

- **Guided opportunity search**
  - Supports jobs, scholarships, grants, and visa requirement discovery.
  - Uses structured intake instead of a single keyword box.

- **Live search orchestration**
  - Starts long-running search runs on the backend.
  - Streams progress and incremental results back to the frontend.
  - Supports stop/resume-style workflows through saved sessions and snapshots.

- **Opportunity enrichment**
  - Uses Valyu for web discovery.
  - Uses TinyFish for deeper extraction on shortlisted pages where needed.
  - Applies filtering, deduplication, source selection, and ranking before results are shown.

- **Candidate profile extraction**
  - Accepts CV uploads in PDF and DOCX.
  - Extracts text locally.
  - Builds a structured candidate profile with a local parser by default, with optional TinyFish-assisted extraction.

- **Search persistence and application tracking**
  - Saves opportunities, documents, applications, intents, and search runs in Postgres through Prisma.
  - Keeps recent search setups available in the frontend for reuse.

- **Billing and quota control**
  - Supports free daily search limits.
  - Includes checkout, subscription management, and webhook handling for Paystack and Polar.

- **Telegram task bridge**
  - Accepts Telegram messages and task actions through webhook endpoints.
  - Can be used for lightweight task capture and reporting.

## Technical overview

### Architecture

The active app is split into two main services:

- `web/`
  - React 19 + Vite frontend
  - Handles auth state, intake flows, search sessions, billing screens, saved opportunities, and live result views

- `backend/`
  - NestJS API with Prisma + PostgreSQL
  - Owns authentication, persistence, search orchestration, CV/profile extraction, billing, and Telegram integration

The root `package.json` runs the current stack with:
- frontend on `http://localhost:3000`
- backend on `http://localhost:4000`

The root scripts target `web/` as the active frontend. There is also a `frontend/` workspace in the repo, but the current local dev flow and deployment path point to `web/`.

### Backend design

The backend is modular and centered around domain-specific NestJS modules:

- `auth`
  - JWT-based authentication and current-user retrieval

- `cv`
  - CV upload and text extraction from PDF/DOCX

- `profile`
  - Candidate profile extraction from CV text
  - Preference updates and profile-linked document snapshots

- `opportunities`
  - Search endpoints for jobs, scholarships, grants, and visas
  - Search run creation, polling, and event streaming
  - Source registries, deduplication, ranking, cache reuse, and enrichment orchestration

- `billing`
  - Search quota enforcement
  - Checkout session creation
  - Subscription summary, cancellation/resume flows, and webhook handling

- `applications`
  - Saved application lifecycle management

- `documents`
  - Generated or user-linked text documents

- `telegram`
  - Telegram webhook, task ingestion, and task reporting

### Search pipeline

The search system is one of the main technical parts of the project:

1. The frontend starts a search run through `/api/opportunities/search/*/runs`.
2. The backend validates the request with `zod`, checks quota, and creates a run record/store entry.
3. The orchestrator queries Valyu for candidate pages from approved domains.
4. Candidates are filtered and deduplicated.
5. Shortlisted pages are optionally enriched through TinyFish extraction.
6. Result items are ranked, normalized, and pushed into the run store.
7. The frontend consumes server-sent events and snapshot endpoints to render live progress.

For job search in particular, the backend includes:
- cached query reuse for repeat searches
- source-scope selection such as global vs regional
- mode selection such as classic vs curated
- concurrency control for extraction workers
- timeout handling, stop requests, and per-run event timelines

### Data model

The Prisma schema shows the project is modeled around persistent search workspaces rather than one-off requests. Core models include:

- `User`
- `CV`
- `CandidateProfile`
- `CandidateIntent`
- `Opportunity`
- `Application`
- `Document`
- `JobSearchRun`
- `BillingCustomer`
- `Subscription`
- `BillingCheckout`
- `DailySearchUsage`
- `BillingWebhookEvent`

This gives the platform durable state for identity, uploaded files, extracted profiles, saved results, application tracking, and monetized usage.

### Integrations

- **Valyu**
  - Used for discovery of public opportunity pages and content search.

- **TinyFish**
  - Used for extraction/enrichment workflows and optional profile structuring.
  - Supports SSE, async runs, batch runs, and fallback polling.

- **Paystack**
  - Used for NGN billing flows.

- **Polar**
  - Used for USD billing flows.

- **Telegram Bot API**
  - Used for webhook-based task capture and reporting.

### Frontend design

The frontend is a Vite React SPA with route-based flows for:

- landing page
- auth
- new search hub
- intake forms by search type
- live session view
- report view
- profile and billing workspace

It stores auth context client-side, talks to the backend through `VITE_API_BASE_URL`, and uses fetch-based SSE handling for live search run updates.

## Repo structure

```text
.
├── backend/     # NestJS API, Prisma schema, orchestrators, integrations
├── web/         # Active React/Vite frontend used by root scripts
├── frontend/    # Additional frontend workspace not used by root dev scripts
├── docs/        # Supporting project notes and docs
├── uploads/     # Local upload storage in some environments
└── README.md
```

## Local development

### Prerequisites

- Node.js
- PostgreSQL
- npm
- optional external credentials for Valyu, TinyFish, Paystack, Polar, and Telegram

### Run the full stack

```bash
npm --prefix web install
npm --prefix backend install
npm run dev
```

This starts:
- frontend at `http://localhost:3000`
- backend at `http://localhost:4000`

### Run the backend only

```bash
cd backend
npm install
cp .env.example .env
# set at least DATABASE_URL and JWT_SECRET
npx prisma migrate dev
npm run start:dev
```

### Run the frontend only

```bash
cd web
npm install
cp .env.example .env
npm run dev
```

The frontend expects `VITE_API_BASE_URL` to point to the backend API, defaulting to `http://localhost:4000/api`.

## Environment notes

### Backend essentials

At minimum, local backend development needs:
- `DATABASE_URL`
- `JWT_SECRET`

Common optional integrations:
- `VALYU_API_KEY`
- `TINYFISH_API_KEY`
- `PAYSTACK_*`
- `POLAR_*`
- `TELEGRAM_*`

Other useful backend flags already documented in [`backend/.env.example`](backend/.env.example) include:
- search quota limits
- source-routing toggles
- search age limits
- TinyFish timeout settings
- LinkedIn import proxy/browser settings
- optional TinyFish profile extraction toggle

### Health and API base

- API prefix: `/api`
- Health endpoint: `/healthz`

## Key API surface

Notable backend endpoints include:

- Auth
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`

- Billing
  - `GET /api/billing/summary`
  - `POST /api/billing/checkout-sessions`
  - `GET /api/billing/customer-portal`
  - `POST /api/billing/subscriptions/:id/cancel`
  - `POST /api/billing/subscriptions/:id/resume`
  - `POST /api/billing/webhooks/paystack`
  - `POST /api/billing/webhooks/polar`

- CV and profile
  - `GET /api/cv`
  - `POST /api/cv/upload`
  - `POST /api/cv/import-linkedin`
  - `GET /api/cv/import-linkedin/:jobId`
  - `GET /api/profile`
  - `POST /api/profile/extract/:cvId`
  - `PATCH /api/profile/:profileId`
  - `GET /api/intent`
  - `PATCH /api/intent`

- Opportunities and applications
  - `GET /api/opportunities/search/jobs`
  - `POST /api/opportunities/search/jobs/runs`
  - `GET /api/opportunities/search/scholarships`
  - `POST /api/opportunities/search/scholarships/runs`
  - `GET /api/opportunities/search/grants`
  - `POST /api/opportunities/search/grants/runs`
  - `GET /api/opportunities/search/visas`
  - `POST /api/opportunities/search/visas/runs`
  - `GET /api/opportunities`
  - `POST /api/opportunities/import`
  - `GET /api/applications`
  - `POST /api/applications`
  - `PATCH /api/applications/:id`

- Documents and Telegram
  - `GET /api/documents`
  - `POST /api/documents`
  - `DELETE /api/documents/:id`
  - `POST /api/telegram/webhook`
  - `GET /api/telegram/tasks`
  - `POST /api/telegram/report`
  - `PATCH /api/telegram/tasks/:id`

## Deployment targets

- Vercel frontend project root: `web/`
- Backend deployment root: `backend/`

## Summary

TinyWorker is a full-stack search and opportunity-management system, not just a landing page or a single API. The core value of the project is the combination of guided user intent, live public-source discovery, enrichment pipelines, durable search state, and billing-aware access control. The technical design reflects that by combining a React search workspace with a NestJS orchestration backend, Prisma persistence, external search/extraction providers, and streamed run updates.
