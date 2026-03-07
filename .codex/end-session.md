# Codex End Session Checklist

Use this checklist to close a development session cleanly.
This is the canonical closeout flow referenced by `.codex/start-session.md` and `.codex/session.md`.

## 1. Inspect Repository State

Run:

```bash
git status
git log -1 --oneline
```

Review modified files and ensure changes belong to the completed milestones.

## 2. Update Context Documentation

Update:
- `docs/dev-session-latest.md`
  - session summary
  - work completed
  - current system state
  - known issues/risks
  - prioritized next steps
- `TASKS.md`
  - mark completed tasks as `[x]`
  - keep Current Sprint in execution order
- `PROJECT_STATE.md` and `ARCHITECTURE.md` if system design changed.

## 3. Validate Scope

- Confirm no unintended application code edits are included.
- Confirm docs match the current repository truth.

## 4. Create Milestone Commits

Use commit discipline from `.codex/session.md`:
- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`
- `style:`
- `test:`

Group files by logical milestone and commit each group separately.

## 5. Final Check

Run:

```bash
git status
```

Target: clean working tree.

## 6. Final Handoff Summary

Report:
- commits created
- key files changed
- remaining known issues
- next prioritized development steps.
