# Codex Session Guide

This is the canonical development workflow. Do not duplicate steps in other `.codex` files.

## Session Initialization

1. Read `README.md`.
2. Read `ARCHITECTURE.md`.
3. Read `PROJECT_STATE.md`.
4. Read `docs/dev-session-latest.md`.
5. Read `TASKS.md`.
6. Run `git status`.
7. Run `git log -1`.
8. Summarize the current repository state before coding.

## Task Driven Development

- Always read `TASKS.md` at session start.
- Select the next unchecked task in **Current Sprint**.
- Implement that task.
- When completed, mark it as `[x]` in `TASKS.md`.
- Move the next item into focus.

## Development Workflow

- Focus on the prioritized "Next Steps" in `docs/dev-session-latest.md` and align with `TASKS.md`.
- Make small, safe, incremental changes.
- Avoid unnecessary rewrites or large refactors unless required by a task.

## Git Commit Discipline

Commits must represent logical milestones.

Allowed commit types:
- `feat:` new feature
- `fix:` bug fix
- `refactor:` structural code change without behavior change
- `docs:` documentation changes
- `chore:` maintenance tasks
- `style:` formatting or lint fixes
- `test:` tests added or updated

Rules:
- Each commit must represent a completed milestone.
- Do not create extremely large commits.
- Group related file changes together.

## Safe Checkpoint Tags

Before risky refactors or large changes, create a rollback checkpoint tag:

```bash
git tag checkpoint-pre-change
```

If the change fails and rollback is needed:

```bash
git reset --hard checkpoint-pre-change
```

## Documentation Responsibilities

- Update project docs when architecture, flows, or module responsibilities change.
- Maintain persistent context files:
  - `ARCHITECTURE.md`
  - `PROJECT_STATE.md`
  - `TASKS.md`
  - `docs/dev-session-latest.md`
  - `.codex/session.md`
  - `.codex/start-session.md`
  - `.codex/end-session.md`

## Session Wrap-Up

When ending a development session, follow `.codex/end-session.md`.
