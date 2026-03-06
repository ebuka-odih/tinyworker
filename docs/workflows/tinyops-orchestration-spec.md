# TinyOps Orchestration Spec (LLM + Tiny Models + TinyFish)

## Objective
Run user-facing bots (Job Scout, Visa Guide, Hotel Verifier, etc.) with reliable outcomes by combining:
- LLM reasoning (ChatGPT/main model) for planning and synthesis
- Tiny models for low-cost normalization and cleanup
- TinyFish for deterministic browser execution and extraction
- Guardrails for safety, cost control, and predictable UX

## 1) Core Concepts and Responsibilities

### 1.1 Three-Layer System
1. **Experience Layer (UI/UX)**
- Captures user input via structured forms (chat optional)
- Shows progress, timeline, and results
- Renders state only (no business logic)

2. **Reasoning and Orchestration Layer (LLMs)**
- Understands intent, chooses strategy, and selects next actions
- Converts user goals into execution plans
- Validates outputs and translates raw data to user-ready responses

3. **Execution Layer (TinyFish)**
- Navigates websites, fills forms, and extracts data
- Returns structured findings plus evidence (URL, timestamps, optional screenshots)
- Executes instructions only (no policy or decision-making)

## 2) High-Level Execution Flow (Per Run)

### Step A - Bot Selection and Context Setup
**Inputs**
- `bot_id` (for example: `job_scout`, `visa_guide`, `hotel_verify`)
- `user_inputs` (structured fields)
- `user_profile` (optional: preferences, prior runs, CV)
- `policy_context` (allowed sources, privacy rules, budget)

**Output**
- `RunContext` (single source of truth for the run)

### Step B - Intent Normalization (Tiny Model)
Use a small model to normalize input and detect missing essentials.

**Tasks**
- Validate required fields
- Normalize values (country, date, job title, currency)
- Detect ambiguity
- Create a short intent summary for logs and UI

**If info is missing**
- Ask one minimal clarification request (prefer forms over chat)
- Do not start browsing until inputs are sufficient

### Step C - Plan Generation (Main Model)
Use a stronger model to create a structured execution plan (not prose).

**Plan must include**
- Goal statement
- Explicit assumptions
- Source strategy (primary and fallback)
- Ordered steps with success criteria
- Limits (time, pages, sources)
- Extraction schema (required fields)
- Evidence requirements (URLs, timestamps, screenshots if needed)

**Plan output**
- `ExecutionPlan` with numbered steps
- Step types:
  - `BROWSE_WITH_TINYFISH`
  - `PROCESS_RESULTS`
  - `VALIDATE`
  - `SUMMARIZE_OUTPUT`
  - `REQUEST_CLARIFICATION` (rare after Step B)

### Step D - Execution (TinyFish Tool Calls)
The orchestrator executes each browse step via TinyFish.

**TinyFish call inputs**
- Target URLs or search queries
- Form values (dates, locations, filters)
- Extraction schema
- Limits:
  - max pages
  - max scroll depth
  - timeout per site
  - allowed domains
- Evidence rules:
  - source URLs
  - timestamps
  - optional screenshots for critical outputs

**TinyFish outputs**
- `RawFindings` (structured items)
- `EvidenceBundle` (URLs, timestamps, screenshots)
- `ExecutionLog` (actions, errors, blockers)

### Step E - Post-Processing and Ranking (Tiny-First, Main Escalation)
Start with tiny model for cheap filtering and dedupe. Escalate only when needed.

**Tiny model tasks**
- Deduplicate listings
- Normalize fields and remove obvious junk
- Apply lightweight heuristic scoring (match quality, recency)

**Escalate to main model if**
- Results are ambiguous
- Ranking needs nuanced reasoning
- Natural-language explanation is required
- Sources conflict and need reconciliation

**Main model tasks**
- Intelligent ranking
- Explain "why these results"
- Identify gaps (requested vs found)
- Recommend next-run improvements

### Step F - Validation and Guardrails (Rules + Main Model)
Validate before showing output.

**Validation checklist**
- Results are on-topic
- Minimum result threshold is met (per bot)
- Evidence includes URLs and timestamps
- No policy/domain violations
- No extraction artifacts (duplicates, broken links, empty key fields)

**If validation fails**
- Trigger fallback:
  1. Try alternate sources
  2. Loosen constraints slightly (only if policy/user permits)
  3. Return partial results with explicit explanation

### Step G - Output Formatting (UI-Ready `ResultPack`)
Produce one consistent payload format across all bots.

**`ResultPack` structure**
- `summary`: plain-language bullets
- `highlights`: top 3 to 5 picks
- `items`: structured table/list
- `evidence`: URLs, timestamps, screenshots where applicable
- `next_actions`: UI actions (Save, Export, Run Again)
- `run_metadata`: cost, runtime, sources, confidence score

UI should render `ResultPack` directly and never parse raw logs.

### Step H - Persistence and History
Store:
- Inputs used
- Final execution plan
- Sources visited
- Final `ResultPack`
- Cost metrics
- Run status (`success`, `partial`, `fail`)

This enables run history and duplicate run behavior.

## 3) Sub-Agent Design (Internal Roles)
Sub-agents are implementation roles, not user-facing products.

### 3.1 Recommended Roles
1. **Planner Agent (Main Model)**
- Builds execution plan and fallback paths

2. **Source Scout (Tiny Model)**
- Picks likely sources from bot allowlist
- Suggests search queries and filters

3. **Extractor Supervisor (Rules + Tiny Model)**
- Verifies extraction schema conformance
- Flags missing fields and anomalies

4. **Ranker Agent (Tiny to Main Escalation)**
- Orders results and supports explanation

5. **Writer Agent (Main Model)**
- Produces user-facing summary, next steps, and disclaimers

6. **Verifier Agent (Rules First)**
- Ensures outputs are safe, consistent, and evidence-backed

These roles can run sequentially under one orchestrator.

## 4) Model Routing Strategy (Cost and Reliability)
Adopt a small-first escalation strategy.

### 4.1 Suggested Routing
**Tiny model**
- Input normalization
- Dedup and cleanup
- Simple classification
- Fast short summaries

**Main model (ChatGPT-class)**
- Planning
- Multi-step reasoning
- Nuanced ranking and explanation
- Error recovery decisions

### 4.2 Escalation Triggers
Escalate when:
- User asks strategy advice (for example: "which is better and why")
- Sources conflict and must be reconciled
- High-quality report writing is required
- Tiny model uncertainty exceeds threshold

## 5) Tool Safety and Policy Controls
Each bot must define a `Policy Profile`.

### 5.1 Per-Bot Policy Profile Must Include
- Allowed domains (primary and fallback)
- Forbidden domains
- Max browse time
- Max pages visited
- Max result items returned
- Evidence level (`low`, `medium`, `high`)
- Sensitive data rules (capture/storage restrictions)
- Upload handling rules (CV/PDF allowed or not)

### 5.2 Default Data Handling Rules
- Persist only what is needed to re-open and audit results
- Do not store full page HTML unless required
- Store extracted fields + evidence references
- Allow users to delete runs

## 6) UX Integration Rules
UI communicates structured data, not free-form prompts.

### 6.1 UI to Orchestrator Contract
- `bot_id`
- `inputs` (validated)
- `preferences` (optional)
- `attachments` (optional: CV/PDF)
- `budget_hint` (for example: `fast` or `thorough`)

### 6.2 Orchestrator to UI Contract
- `run_state` progression:
  - `preparing`
  - `browsing`
  - `processing`
  - `validating`
  - `ready`
- `progress_steps` (human-readable)
- `partial_previews` (optional)
- Final `ResultPack`

## 7) Fallback and Failure Playbook
Failures must remain graceful and actionable.

### 7.1 Fallback Ladder
1. Retry same source with lighter interaction
2. Switch to alternate sources
3. Reduce filters (with user permission or safe default)
4. Return partial results with clear explanation
5. Offer "Run Again" with suggested adjustments

### 7.2 Failure Output Must Include
- What failed (simple language)
- What was attempted
- What user can do next
- Partial data if available

## 8) Cross-Bot Intelligence (Optional Future Layer)
After baseline stability, enable shared context:
- CV keywords reused by Job Scout and Scholarship Finder
- Saved destinations reused by travel bots
- Watchlist tickers reused by finance bots

Memory layer rules:
- Opt-in only
- User editable
- Scoped by category

## 9) Minimal Orchestration MVP (Build Order)
1. Bot registry (`bot_id` -> policy profile -> UI schema -> allowed sources)
2. Orchestrator skeleton (`RunContext`, `ExecutionPlan`, `ResultPack`)
3. Model router (tiny-first with escalation)
4. TinyFish adapter (browse and extract)
5. Result formatting and persistence
6. UI progress state machine streaming

## 10) Deliverable File Structure
Save this spec as:
- `docs/workflows/tinyops-orchestration-spec.md`

For each new bot, include:
- `bot_profile.md` (purpose, inputs, outputs)
- `policy_profile.json` (domains, limits, evidence)
- `extraction_schema.json` (required fields)
- `ui_schema.json` (form steps and labels)

## Optional Next Artifact
Create a "Bot Definition Template" in markdown with the exact declaration fields for:
- inputs
- steps
- sources
- extraction schema
- UI copy
- evidence level
- budget

This lets future code agents generate bot implementations consistently.
