# TinyFinder Search Modes Phase Plan

## Objective

Align the TinyFinder job search product with two clear user-facing modes:

- `Default Search`: cleaner, curated, high-signal search
- `Wide Search`: broader coverage with ATS and fallback sources

The current system should evolve toward this model in phases without breaking the existing search flow.

## Current Constraint

The current backend still runs through the existing Valyu + TinyFish orchestrator spine.

Internal mode names currently are:

- `curated`
- `classic`

For now, the user-facing mapping should be:

- `Default Search` -> internal `curated`
- `Wide Search` -> internal `classic`

This file covers the full rollout from Phase A through Phase D.

---

## Phase A: Naming And UX Alignment

### Goal

Make the product language correct and understandable before changing deeper backend architecture.

### Scope

- rename the frontend mode labels
- align the review step and session UI wording
- keep the current internal enum values
- keep the current backend execution path unchanged

### UX Rules

- `Default Search` is the recommended option
- `Wide Search` is the broader option
- the user should see the difference before starting the search
- the selected mode should remain visible in the session UI

### Implementation

- update the job intake mode cards
- update review summaries
- update session badges and filter-panel copy
- keep internal mode payloads as `curated` and `classic`

### Files

- `web/src/pages/IntakePage.tsx`
- `web/src/pages/SessionPage.tsx`

### Acceptance Criteria

- job intake shows `Default Search` and `Wide Search`
- review step uses the same labels
- session header and sidebar use the same labels
- no backend behavior changes yet

---

## Phase B: Registry Expansion And Source Grouping

### Goal

Expand the approved source registry so the two modes can be expressed clearly in backend configuration.

### Target Source Groups

#### Default Search registry

- We Work Remotely
- Remotive
- Remote.co
- Remote OK
- JustRemote
- Working Nomads
- Jobspresso
- DailyRemote
- RemoteAfrica

#### Wide Search registry

Wide Search includes:

- all Default Search sources
- Greenhouse
- Lever
- Ashby
- Djinni
- LinkedIn Jobs
- Indeed
- Glassdoor

### Implementation

- expand `backend/src/opportunities/job-source-registry.ts`
- add source group metadata for:
  - default curated boards
  - ATS/direct sources
  - aggregator fallback sources
- keep the current runtime path operational while the registry grows

### Acceptance Criteria

- registry can represent both modes cleanly
- source groups are explicit and test-covered
- no generic open-web source list is needed for jobs

---

## Phase C: Source Routing And URL Generation

### Goal

Stop using Valyu for generic web-wide job discovery.

Valyu should become the routing layer that:

1. reads the query
2. identifies search intent
3. selects approved sources from the registry
4. ranks source priority
5. returns a source execution plan

### Implementation

- add a source-router module
- add a search URL generator module
- for `Default Search`, only generate source URLs from the curated board registry
- for `Wide Search`, generate source URLs in this order:
  - curated boards first
  - ATS/direct sources second
  - aggregators last

### Acceptance Criteria

- Valyu no longer returns generic job links for jobs
- TinyFish receives generated source URLs instead of web-discovered detail links
- mode-specific source planning is deterministic and testable

---

## Phase D: Tiered TinyFish Execution And Ranking

### Goal

Make TinyFish the actual execution layer for both modes.

### TinyFish Responsibilities

- open source search URLs
- browse listing pages
- collect job cards
- open detail pages if needed
- extract structured job data
- return normalized results

### Execution Model

#### Default Search

- prioritize curated boards only
- optimize for cleaner results
- optimize for low duplication
- keep review quality high

#### Wide Search

- run curated boards first
- then ATS/direct sources
- use aggregators as fallback or secondary enrichment
- aggressively deduplicate repeated jobs
- rank curated and direct-source jobs above aggregator duplicates

### Acceptance Criteria

- mode-specific source execution works end-to-end
- aggregator duplicates are downranked behind curated/direct results
- session UI remains shared across both modes
- the current job search UI does not need redesign to support this

---

## Rollout Notes

- Phase A can ship immediately
- Phase B can begin without user-facing changes
- Phase C is the backend architecture shift
- Phase D is the full behavior completion

## Non-Goals For Phase A

- no deep backend refactor yet
- no full source registry expansion yet
- no new session UI redesign
- no removal of the current orchestrator spine

## Recommended Order

1. Phase A
2. Phase B
3. Phase C
4. Phase D
