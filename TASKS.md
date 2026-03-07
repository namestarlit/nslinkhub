# TASKS

## Current Sprint

- [ ] Implement real PDF artifact generation and storage integration
- [ ] Add automated migration execution workflow for local/dev/CI
- [ ] Harden import parsers (CSV quoting, bookmarks fidelity, WhatsApp parsing)
- [ ] Add e2e coverage for auth/visibility/reorder/import/export flows

## Next Tasks

- [ ] Add deep health checks for PostgreSQL and Redis
- [ ] Add global error code normalization and exception mapping
- [ ] Add export artifact/job retention cleanup jobs
- [ ] Implement persistent refresh-token/session revocation

## Backlog

- [ ] Add full-text search for repositories and entries
- [ ] Add collaboration/sharing permissions beyond owner/admin
- [ ] Add analytics/audit events for imports/exports and sharing

## Completed

- [x] Establish NestJS v2 modular architecture and API scaffolding
- [x] Implement core entities and SQL migrations (`0001`, `0002`)
- [x] Implement JWT auth, guards, and user/repository/entry/tag core services
- [x] Implement import endpoints (CSV, bookmarks HTML, WhatsApp TXT) MVP
- [x] Replace in-memory PDF jobs with BullMQ + DB-backed `export_jobs`
- [x] Add persistent architecture and session context docs (`ARCHITECTURE.md`, `.codex/*`)
- [x] Patch post-review correctness gaps (reorder versioning/swap safety, parent update checks, import position calculation, logout guard, shared URL canonicalization)
