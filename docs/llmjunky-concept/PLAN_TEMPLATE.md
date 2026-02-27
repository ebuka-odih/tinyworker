# Plan Template (Swarm-ready)

> Use this template for any TinyWorker plan that will be executed via subagents.

## Project
- Name:
- Goal:
- Non-goals:
- Constraints:

## Dependency graph rules
- Every task has an ID: `T1`, `T2`, ...
- Every task declares `depends_on: []`.
- A task is **unblocked** when all dependencies are complete.

## Tasks

### T1 — Example task name
- depends_on: []
- owner: orchestrator | frontend | backend | ops | qa
- description:
- files:
  - path/to/file
- acceptance_criteria:
  - ...
- validation:
  - command(s) to run
- done: false

### T2 — Example task name
- depends_on: [T1]
- owner: backend
- description:
- files:
  - ...
- acceptance_criteria:
  - ...
- validation:
  - ...
- done: false
