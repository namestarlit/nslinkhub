# Codex Session Guide

## Session Initialization

1. Read `README.md`.
2. Read `ARCHITECTURE.md`.
3. Read `PROJECT_STATE.md`.
4. Read `docs/dev-session-latest.md`.
5. Run `git status`.
6. Run `git log -1`.
7. Summarize the current repository state before coding.

## Development Workflow

- Focus on the prioritized "Next Steps" in `docs/dev-session-latest.md`.
- Make small, safe, incremental changes.
- Avoid unnecessary rewrites or large refactors unless required by a next step.

## Documentation Responsibilities

- Update project docs when architecture, flows, or module responsibilities change.
- Maintain persistent context files:
  - `ARCHITECTURE.md`
  - `PROJECT_STATE.md`
  - `docs/dev-session-latest.md`
  - `.codex/session.md`
  - `.codex/restart.md`

## Session Wrap-Up

Before ending a development session:
- Update `docs/dev-session-latest.md`.
- Record completed work.
- Record current system state.
- Record known issues/risks.
- Record prioritized next steps for the next session.
