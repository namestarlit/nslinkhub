# Reference Context (`ref/`)

`ref/` is a disposable, worktree-local scratch area, ignored by git except for
its README. See `ref/README.md` for what belongs there.

## Rules

- Never store secrets, credentials, PII, production data, or the only copy of
  a durable decision in `ref/`.
- Durable findings are promoted into `docs/`, code comments, tests, tooling,
  or the active ExecPlan — then the temporary material is deleted.
- Completed ExecPlans must remain understandable after `ref/` is emptied.
- Notes handed off between sibling projects land in the receiving repository's
  `ref/` and are promoted or deleted there.

## Cleanup

At the end of an ExecPlan, or when `ref/` accumulates stale material:

1. Re-read each file; promote anything durable to its proper home.
2. Delete the rest. `ref/` starting empty is the healthy state.
