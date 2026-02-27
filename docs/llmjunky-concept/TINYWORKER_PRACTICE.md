# Applying the Multi‑Agent / Swarm Playbook to TinyWorker

This document turns the playbook rules into **how we build TinyWorker** (frontend + backend + TinyFish orchestration).

## 1) TinyWorker structure (what we’re building)

TinyWorker is a job discovery + CV tailoring web app:
- Upload CV (PDF/DOCX)
- Extract CandidateProfile (skills/roles/keywords)
- Search jobs
- Rank + explain match
- Tailor CV + cover letter per job

It’s a multi-part system: UI, backend API, background work, and integration calls (TinyFish).

That makes it a perfect candidate for the swarm approach.

---

## 2) Orchestrator vs workers: role assignment

### Orchestrator (this main agent)
Responsibilities:
- Own `PROJECT_PLAN.md` and `docs/plans/*`
- Break work into small tasks
- Spawn subagents with explicit context
- Review diffs and run validations
- Keep prod stable (nginx/services)

### Workers (subagents)
Discrete roles we will use:
- **Frontend worker**: UI changes, routing, components, shadcn reskin
- **Backend worker**: Prisma, controllers, auth, APIs
- **Ops worker**: nginx/systemd, deployment, logs
- **QA worker**: smoke tests, regression checklist
- **Security worker**: secrets handling, auth boundaries, upload limits

Model policy:
- Orchestrator = strong model
- Workers = **Qwen** (cheap coding muscle)

---

## 3) Execution mode: Swarm Waves (default)

We use **Swarm Waves** because TinyWorker has dependencies (schema → API → UI → flows).

Wave examples:
- Wave 1: schema migrations + upload endpoint
- Wave 2: profile extraction endpoint + UI wiring
- Wave 3: job search + results normalization

We only use Super Swarms for purely parallel tasks (e.g., “polish 6 pages” + “write docs” + “add icons”).

---

## 4) The required TinyWorker worker prompt template

When we spawn a worker, we will front-load this:

- Plan: `PROJECT_PLAN.md`
- Task id + goal
- Exact file paths
- Acceptance criteria
- Validation steps
- Commit discipline (commit only what you changed; never push)

### Example prompt (drop-in)

```text
You are implementing a specific task from TinyWorker’s plan.

## Context
Plan: /root/.openclaw/workspace/tinyworker/PROJECT_PLAN.md
Goal: Phase 1 — Profile Intelligence

## Your Task
Task: Add “Review Profile” UI page
Location:
- /root/.openclaw/workspace/tinyworker/src/App.tsx
- /root/.openclaw/workspace/tinyworker/src/components/ProfileReview.tsx

Description:
- After CV upload, add a Review Profile step that renders extracted CandidateProfile fields.
- Allow editing preferred_roles, preferred_locations, links.

Acceptance Criteria:
- UI renders profile JSON into readable sections
- Editable fields persist locally (for now) and call API when available
- Mobile layout stable; no overflow

Validation:
- npm run build passes
- Manual smoke: upload cv → extract profile → review page loads

## Instructions
- Keep work atomic & committable
- Don’t touch unrelated files
- Commit your changes with a clear message
- Return a summary with files changed + validation run
```

---

## 5) Concrete TinyWorker tasks shaped for swarms

### Phase 1 (Profile Intelligence)
Workers can safely split:
- Backend: `/backend` endpoints + storage
- Frontend: CV upload UX + progress indicators
- QA: upload regressions (pdf/docx/large file/413)

### Phase 2 (Guided Questions)
Workers split:
- Frontend: wizard cards + state machine
- Backend: CandidateIntent schema + persistence

### Phase 3 (Job Search)
Workers split:
- Backend: job search queue + storage tables
- Worker service: TinyFish runs with rate limit
- Frontend: job list + filters + saved jobs

### Phase 4 (Tailor CV)
Workers split:
- Backend: job detail capture + tailor outputs
- Frontend: tailor workspace panels
- QA: verify “no fabrication” rules

---

## 6) Validation gates (non-negotiable)

For each task:
- Build passes
- Endpoint smoke test (curl)
- UI smoke test on mobile
- No secrets in git

For merged waves:
- Regression on CV upload
- Regression on Agent page layout

---

## 7) Cost control rules (why we’re doing this)

- Use Qwen workers + strong orchestrator.
- Front-load context to reduce tool calls.
- Prefer Swarm Waves to avoid conflicts.
- Persist state to files/DB; don’t rely on long chat context.

---

## 8) Immediate adoption inside TinyWorker

Starting now we will:
- Maintain a single plan file (`PROJECT_PLAN.md`) and update it as tasks complete.
- Write each task as a worker-ready unit (paths, acceptance, validation).
- Keep orchestrator focused on review + conflict resolution.
