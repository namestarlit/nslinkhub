# ADR-0004: Passwordless sign-in with email codes; better-auth owns credentials

**Status:** accepted  
**Date:** 2026-10-07

## Context

Passwords add reset flows, breach exposure and support load for a product that
already relies on email.

## Options considered

- Passwords + email verification
- Magic links
- Eight-digit email codes

## Decision

Sign-in is an eight-digit email code. better-auth owns credentials, sessions and
verification primitives; the product owns identity, onboarding and
authorization. Session resolution goes through `resolveSessionUser`; services
see `AuthUser`, never better-auth types. Sign-up onboarding lives in an
app-owned service callable from any auth path.

## Rationale

- No passwords to store or reset.
- Codes work across devices (a magic link opens wherever the mail is read).
- The future ns-series SSO can call the same onboarding service.

## Constraints to preserve

- Codes are plain digits, single-use, short-lived, attempt-limited and resend-throttled.
- Code inputs accept pasted spaces or dashes; only digits count.
- The better-auth handler is mounted before body parsers.

## Links

- [auth-delivery-integration.md](../design-docs/auth-delivery-integration.md)
- [identity-sso.md](../design-docs/identity-sso.md)
