# Email verification and interrupted actions

Status: implemented in the web. Settled in
[ADR-0010](../engineering-decisions/0010-one-verification-flow.md); security
rules and limits in [SECURITY.md](../SECURITY.md).

## Flow and interrupted actions

Every email-code situation is one web flow with a purpose — `sign-in`,
`first-link`, `continue`, `resume`, `confirm`, `invitation` — that sets the
wording and what runs after the code (`apps/web/src/lib/verification.ts`). The
start screen sends nothing until the person chooses Send code; a known address
is shown, never asked for again. Sensitive operator actions answer
`recent_auth_required`, and the web asks the operator to confirm it's them.

An action interrupted by verification (a step-up, or any form action whose
session ended) is kept in a 15-minute encrypted HttpOnly cookie and replayed
once after the code, with the new session, then the person lands back where
they were with the result. It belongs to the account that started it (a keyed
fingerprint of the last signed-in email) and is discarded if anyone else signs
in. Rules and accepted limits: [SECURITY.md](../SECURITY.md).
