# ADR-0010: One email-verification flow with purposes; actions resume for their owner

**Status:** accepted  
**Date:** 2026-10-07

## Context

Sign-in, first link, signing in to do something, an ended session, confirming a
sensitive action and invitations all send a code; separate screens drifted.

## Options considered

- Per-feature verification screens
- One flow; the purpose decides wording and what runs afterwards

## Decision

All email-code situations share two screens (start, code) driven by a purpose:
sign-in, first-link, continue, resume, confirm, invitation. A known address is
shown in bold, never asked for. An action interrupted by verification is kept
encrypted for 15 minutes and replayed once after the code — only for the person
it belongs to (a keyed fingerprint of the last signed-in email).

## Rationale

- One place for verification UX and security.
- Nothing typed is lost to an expired session.

## Constraints to preserve

- A waiting action never replays for a different account.
- Nothing is emailed until the person chooses to send.

## Links

- [SECURITY.md](../SECURITY.md)
- [web-interface-system.md](../design-docs/web-interface-system.md)
