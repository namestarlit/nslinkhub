# Invitations + membership management (Phase D)

This ExecPlan is a living document. Maintain it according to `PLANS.md`.

## Purpose / Big Picture

Phase D of `docs/design-docs/hub-architecture.md`. Hub roles become
enforceable (owner > admin > member) and hubs gain the ways people join and
are managed: invitations with authenticated acceptance, member listing, role
changes, removal (under the last-owner rule), and explicit ownership transfer.
Observable: an owner invites someone by email, they accept with a token and
become a member who can write content in the hub; the sole owner cannot be
removed or demoted; an admin cannot grant admin; ownership transfers in one
explicit step.

## Progress

- [x] (2026-07-04) `HubsService`: `roleRank`, `getMembershipRole`, `requireHubRole`,
      `countOwners`.
- [x] (2026-07-04) Token util (`generateToken`/`hashToken`); invitation + membership DTOs.
- [x] (2026-07-04) `HubInvitationsService`: create (role-gated), list, revoke, accept
      (email-matched, one-time, expiring).
- [x] (2026-07-04) `HubMembersService`: listMembers, changeRole (owner-only),
      removeMember (admin/owner/self, last-owner rule), transferOwnership.
- [x] (2026-07-04) Controllers: `HubMembersController`
      (`/hubs/:hubId/{members,invitations,transfer-ownership}`),
      `InvitationsController` (`/invitations/accept`); wire into HubsModule.
- [x] (2026-07-04) E2E: invite/accept, last-owner rule, role gating, transfer, email
      mismatch; `bun run verify` green; live smoke.
- [x] (2026-07-04) Docs (ARCHITECTURE, CHANGELOG) + plan to completed/.

## Surprises & Discoveries

- Observation: a supertest helper that returned the request chain and let
  callers append `.expect()` tripped `no-unsafe-call` (the wrapper's return
  type didn't resolve). Awaiting `.expect(status)` inside the helper and
  returning the `Response` fixed it.
  Evidence: lint clean after the change; 23 e2e green.

## Decision Log

- Decision: role PATCH sets only `member`/`admin` and is owner-only; the
  `owner` role is reachable only via transfer-ownership.
  Rationale: every meaningful role change involves the admin grant, which the
  design reserves to owners; ownership is a separate explicit workflow.
  Date/Author: 2026-07-04 / namestarlit
- Decision: invitation acceptance requires the authenticated user's email to
  match the invitation email (case-insensitive); existing accounts only.
  Rationale: keeps invitations targeted (principle 5) and prevents token
  forwarding to the wrong account; pending identities for unregistered emails
  are a tracked Phase E item.
  Date/Author: 2026-07-04 / namestarlit
- Decision: transfer-ownership promotes the target to owner and demotes the
  actor to admin in one transaction (single-step, not a two-party handshake).
  Rationale: the design requires "an explicit workflow"; single-step keeps at
  least one owner at all times and is enough for Phase D.
  Date/Author: 2026-07-04 / namestarlit
- Decision: platform admins (`user.role === admin`) bypass hub-role checks.
  Rationale: consistent with the collection policy service.
  Date/Author: 2026-07-04 / namestarlit

## Outcomes & Retrospective

Shipped as planned; the hub backend is now feature-complete. Roles are
enforced end to end, invitations use authenticated email-matched acceptance,
and the last-owner rule holds across removal, demotion, and self-leave. The
single-step ownership transfer keeps an owner present at all times. Verified
green (build + lint + unit + 23 e2e) and via a live invite/accept smoke.
Next: Track W2 (shared types) or straight to W3 (web) per the plan.

## Context And Orientation

`hub_memberships` (owner|admin|member, CHECK-constrained) and `hub_invitations`
(email, role, token_hash unique, status pending|accepted|revoked|expired,
expires_at) exist from Phase B with no endpoints. `HubsService` has
`isMember/assertMember/getPrimaryHubId/createHubWithOwner`. `AuthUser` carries
`{ userId, username, role }` (no email — load the user for the accept email
match). Collection management already uses membership via
`CollectionPolicyService`; that stays member-level.

## Plan Of Work

1. `HubsService`: add `roleRank`, `getMembershipRole(hubId,userId)`,
   `requireHubRole(hubId,user,minRole)` (admin bypass), `countOwners(hubId)`.
2. `src/common/utils/token.util.ts`: `generateToken()` → `{token, tokenHash}`,
   `hashToken(token)`.
3. DTOs: create-invitation `{email, role: member|admin}`, accept-invitation
   `{token}`, change-role `{role: member|admin}`, transfer-ownership `{userId}`.
4. `HubInvitationsService`, `HubMembersService` per the capability matrix
   (roles + last-owner rule). Email delivery is a logged no-op.
5. Controllers + HubsModule wiring.
6. E2E + verify + live smoke; docs; complete the plan.

## Concrete Steps

```bash
docker compose up -d
bun run verify
```

## Validation And Acceptance

- Owner invites `member`; invitee (matching email) accepts → membership +
  content write in the hub; mismatched email → rejected; expired/used token →
  rejected.
- Admin inviting `admin` → 403; member inviting anyone → 403.
- Sole owner: leave/remove/demote → blocked (400/403).
- Owner removes a member; admin removes a member but not an admin/owner.
- Transfer: owner → admin, target member → owner; new owner has owner powers.
- `bun run verify` green; live smoke of invite→accept→write.

## Idempotence And Recovery

Additive endpoints; no schema change. Acceptance upserts membership
(idempotent on the composite key) and consumes the one-time token. Recovery is
git.

## Interfaces And Dependencies

- Preserves all prior contracts (envelope, request id, cursor, camelCase,
  collection policy).
- New routes: `POST/GET /hubs/:hubId/invitations`,
  `DELETE /hubs/:hubId/invitations/:id`, `POST /invitations/accept`,
  `GET /hubs/:hubId/members`, `PATCH/DELETE /hubs/:hubId/members/:userId`,
  `POST /hubs/:hubId/transfer-ownership`.
