# <Short, action-oriented outcome>

This ExecPlan is a living document. Maintain it according to `PLANS.md`.
Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and
`Outcomes & Retrospective` current as work proceeds.

## Purpose / Big Picture

Describe the outcome and how to observe it working.

## Progress

- [ ] (YYYY-MM-DD HH:MMZ) Add the first concrete step.

## Surprises & Discoveries

- Observation: None yet.
  Evidence: -

## Decision Log

- Decision: Use this ExecPlan.
  Rationale: The work is substantial enough to require a resumable record.
  Date/Author: YYYY-MM-DD / contributor

## Outcomes & Retrospective

Not started.

## Context And Orientation

Describe the current state, relevant repository paths, and non-obvious terms.

## Plan Of Work

Describe the sequence of edits and why it is ordered this way.

## Concrete Steps

Run commands from the repository root unless noted otherwise:

```bash
bun run build && bun run lint && bun test src && bun test test
```

Expected result: build, lint, unit, and e2e stages pass (e2e requires
`docker compose up -d`).

## Validation And Acceptance

- State observable, behavior-based acceptance criteria.

## Idempotence And Recovery

Explain repeatable steps, recovery paths, and any destructive operations.

## Artifacts And Notes

Record concise evidence that helps the next contributor.
Temporary working context may live under git-ignored `ref/`, but this plan must
remain understandable after those temporary files are deleted.

## Interfaces And Dependencies

List important contracts, package boundaries, and dependency assumptions.
