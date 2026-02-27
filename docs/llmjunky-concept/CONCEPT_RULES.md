# Codex Multi‑Agent / Swarm Playbook — Concept Rules (Distilled)

> Source: LLMJunky “Codex Multi‑Agent Playbook / Swarms Lvl 1” (tweet/article text provided in chat).  
> Purpose: turn the playbook into **operational rules** we can enforce in our own projects.

## 0) Definitions (shared language)

- **Orchestrator**: the parent agent session that owns the plan, spawns workers, reviews output, resolves conflicts, and keeps the project moving.
- **Worker / Subagent**: a single-purpose executor that implements one task with tight scope.
- **Swarm**: multiple workers running in parallel under one orchestrator.
- **Context engineering**: deliberately front-loading the worker prompt with all relevant constraints, files, and acceptance criteria so the worker does not “guess”.

## 1) First principle: planning quality controls everything

**Rule 1.1 — Ambiguity is multiplicative.**
- Any unclear requirement or acceptance criterion will multiply across workers.
- If you’re going to run parallel agents, the plan must be **exceptionally explicit**.

**Rule 1.2 — The architect is human; the builders are agents.**
- You (or the orchestrator) own the blueprint; workers execute.
- If the blueprint is weak, you’ll get token‑expensive drift.

**Rule 1.3 — Build dependency maps into the plan.**
- Plans must include a dependency graph so the orchestrator knows which tasks are unblocked.
- Minimal format: each task declares `depends_on: [T1, T2]`.

## 2) Orchestrator responsibilities (strict role boundaries)

**Rule 2.1 — Orchestrator only does “foreman” work.**
The orchestrator is responsible for:
1) tracking plan state
2) spawning workers
3) front‑loading worker prompts
4) validating worker output
5) resolving conflicts
6) continuous forward motion

The orchestrator should avoid doing large implementation work itself unless required.

**Rule 2.2 — Don’t reset context between planning and implementing.**
- Keep the plan + decisions in the orchestrator context.
- If context is low, compact once; the orchestrator will spend fewer tokens than workers.

## 3) Two execution modes

### Swarm Waves (recommended default)
- Launch one worker per **unblocked** task (based on `depends_on`).
- After completion, update the plan state, then launch the next wave.
- Lowest conflict + lowest token burn.

### Super Swarms (speed-first)
- Launch as many agents as `max_threads` allows regardless of dependencies.
- Expect conflicts; best for decoupled tasks (UI polish, docs).


### 3A) Swarm Waves (recommended default)
**Rule 3A.1 — Launch only unblocked tasks in waves.**
- Spawn one worker per unblocked task.
- When tasks finish, update plan state, then launch the next wave.

**Why:** fewer conflicts, fewer wasted tokens, higher accuracy.

### 3B) Super Swarms (total parallelism)
**Rule 3B.1 — Launch maximum parallel workers regardless of dependencies only when speed is worth conflict.**
- Increase parallelism via `max_threads`.
- Expect merge conflicts and “dependee not yet exists” errors.

**Rule 3B.2 — Reduce parallelism if you hit provider limits.**
- If you get 429/rate errors, lower `max_threads`.

## 4) The “secret sauce”: front-load worker context

**Rule 4.1 — Workers must start with full context, not discovery.**
Front-load:
- plan name + goal
- task id + description
- exact file paths
- constraints / risks
- acceptance criteria
- validation steps

This reduces tool calls, token burn, and drift—especially for small/fast models.

**Rule 4.2 — Use a standard worker prompt template.**
Workers should always be instructed to:
- keep work atomic + committable
- update the plan file when done
- commit only files they touched
- never push

## 5) Model strategy

**Rule 5.1 — Use a strong orchestrator model; use cheaper workers.**
- The orchestrator handles ambiguity and conflict resolution.
- Workers execute discrete tasks; smaller/faster models can shine when prompts are explicit.

**Rule 5.2 — Configure models per role.**
- Define custom agent roles and map them to specific models/reasoning levels.

## 6) Configuration rules (minimum viable)

### 6.1 Enable swarms + parallelism in Codex (`~/.codex/config.toml`)

Minimal example (adapt to your environment):

```toml
# Recommended: strong orchestrator model for planning/coordination
model = "gpt-5.3-codex"
plan_mode_reasoning_effort = "xhigh"
model_reasoning_effort = "high"

[features]
collaboration_modes = true
multi_agent = true

[agents]
max_threads = 16 # base often ~6. Increase for larger swarms.

# Example worker role
[agents.sparky]
description = "Executes implementation tasks from a structured plan."
config_file = "agents/sparky.toml"
```

### 6.2 Define custom roles

Example:

```toml
[agents.security_auditor]
description = "Finds auth, injection, and secrets risks."
config_file = "agents/security_auditor.toml"

[agents.sparky]
description = "Use for executing implementation tasks from a structured plan."
config_file = "agents/sparky.toml"
```

## 7) Validation and TDD

**Rule 7.1 — Prefer tests before workers when feasible.**
- Either orchestrator writes tests first,
- Or acceptance criteria include explicit verification.

## 8) Output discipline

**Rule 8.1 — Every worker ends with a structured summary**
- files modified/created
- changes made
- validation run
- remaining risks

**Rule 8.2 — All progress is written to durable artifacts**
- Update `*-plan.md` as tasks complete.
- This extends horizon without relying on chat context.
