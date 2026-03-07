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

## 2. Pre-Commit Comprehensive Review Loop

Before creating any commit, run an iterative review-and-fix loop until no issues remain.

1. Run `/review` with:

```text
Perform a comprehensive review of all recent changes. Identify any issues that could break functionality, introduce bugs, violate project conventions, or cause failing tests. Suggest fixes for each issue.
```

2. Apply all identified fixes.
3. Re-run `/review`.
4. Repeat until review reports no remaining issues.

Review must aim to catch all blocking quality issues, including:
- logic errors
- missing edge-case handling
- failing/incomplete tests
- documentation inconsistencies
- style/structural maintainability problems

## 3. Update Context Documentation

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

## 4. Validate Scope

- Confirm no unintended application code edits are included.
- Confirm docs match the current repository truth.

## 5. Create Milestone Commits

Use commit discipline from `.codex/session.md`:
- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`
- `style:`
- `test:`

Group files by logical milestone and commit each group separately.
Stage all files modified during the session before committing each milestone.

## 6. Clean Repository Check

Run:

```bash
git status
```

Target: clean working tree.

## 7. Final Handoff Summary

Report:
- all issues discovered during review
- all fixes applied
- commits created
- key files changed
- remaining known issues
- next prioritized development steps.

## 8. Push Policy

Do not push automatically. Stop after local commits and summary.
Remote push is a manual developer action.
