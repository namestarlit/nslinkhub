# Developer Workflow

This guide defines a simple lifecycle for Codex sessions: start, continue, close.

## 1. Start a Session

When: start of a new coding session.

Run:

```bash
codex "Follow .codex/start-session.md"
```

Expected result:
- Codex loads `.codex/session.md`
- Reads `ARCHITECTURE.md`, `PROJECT_STATE.md`, `docs/dev-session-latest.md`, `TASKS.md`
- Checks current git state and summarizes before coding

## 2. Continue the Session

When: after startup summary, and throughout the session.

Default:
- Codex should take the next unchecked task in `TASKS.md` under **Current Sprint**.

If you want to explicitly continue from current state, run:

```bash
codex "Read .codex/session.md and continue with the next Current Sprint task from TASKS.md"
```

If you want to force a specific task, say:

```text
Work on this task: <task description>
```

## 3. Monitor Live Changes (Recommended)

When: while Codex is implementing.

Use a second terminal:

```bash
watch -n 2 git status
watch -n 2 git diff --stat
```

Use these prompts when needed:

```text
Pause and explain the current changes.
```

```text
Stop and split this into smaller milestones.
```

## 4. Create Safety Checkpoints

When: before large refactors, schema rewrites, or broad file edits.

Create checkpoint:

```bash
git tag checkpoint-pre-change
```

Rollback if needed:

```bash
git reset --hard checkpoint-pre-change
```

## 5. Commit by Milestone

When: after each completed logical unit (not at random intervals).

Commit policy:
- One logical milestone per commit
- Keep scope reviewable
- Group related files only

Allowed commit types:
- `feat:` new feature
- `fix:` bug fix
- `refactor:` structural change without behavior change
- `docs:` documentation only
- `chore:` maintenance/config/tooling
- `style:` formatting/lint-only
- `test:` tests added or updated

Example instruction to Codex:

```text
Create a milestone commit for this completed task using the correct commit type.
```

## 6. Review Before Moving On

When: before approving a commit or moving to next task.

Run:

```bash
git diff --stat
git diff
git log --oneline --max-count=10
```

## 7. Close the Session

When: done for the day or handing over work.

Run:

```bash
codex "Follow .codex/end-session.md"
```

Expected result:
- `docs/dev-session-latest.md` updated
- `PROJECT_STATE.md` / `ARCHITECTURE.md` updated if architecture changed
- task progress updated in `TASKS.md`
- final milestone commits prepared

## 8. Quick Commands

1. Start:

```bash
codex "Follow .codex/start-session.md"
```

2. Continue:

```bash
codex "Read .codex/session.md and continue with TASKS.md"
```

3. Close:

```bash
codex "Follow .codex/end-session.md"
```
