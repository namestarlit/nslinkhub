# Engineering Decisions

Settled engineering decisions and their rationale (often called Architecture
Decision Records), covering architecture, security, workflow, UX and tooling
choices. They are stronger than design notes: **do not reverse one without
recording the new evidence, the tradeoff and the reason**, in a new record that
supersedes it.

Records are for business-process and architecture decisions that much else
depends on: the tenancy and access model, identity and authentication, how
writes are ordered, where rules live, how the team ships. Feature rules, limits,
copy and visual guidance belong in the design docs; renames and field changes
belong in `CHANGELOG.md`. A record states the decision, why, and what must hold; it
is not a task list and holds no design scope. Journeys, statuses, endpoints,
limits and screens belong in a design document (the *how*), which the record
links to; implementation belongs in an ExecPlan (the *work*).

## Lifecycle

```text
question -> design shaping -> accepted decision -> implemented in an ExecPlan
         -> superseded only by a new record with rationale and a migration path
```

Statuses: `accepted` (current and binding), `superseded` (kept for history,
links to its replacement), `rejected` (considered and not chosen).

## Required contents

Status and date; context; options considered; the decision; rationale;
constraints that implementation must preserve; links to design docs and plans.
Number records sequentially (`NNNN-short-slug.md`) and list them below.

## Current decisions

- [0001-drive-tenancy-model.md](0001-drive-tenancy-model.md) — Google-Drive tenancy: one hub per user, per-collection sharing.
- [0002-immutable-identities.md](0002-immutable-identities.md) — Immutable UUIDv7 identities; mutable names never in contracts.
- [0003-backend-owns-rules-native-forms.md](0003-backend-owns-rules-native-forms.md) — The backend owns the rules; native forms work without JavaScript.
- [0004-passwordless-email-codes.md](0004-passwordless-email-codes.md) — Passwordless sign-in with email codes; better-auth owns credentials.
- [0005-serialized-writes.md](0005-serialized-writes.md) — One global write lock serializes authenticated mutations.
- [0006-pre-deployment-no-compat.md](0006-pre-deployment-no-compat.md) — Pre-deployment: no compatibility code; squash and reset freely.
- [0007-resolved-titles-read-only-items.md](0007-resolved-titles-read-only-items.md) — Link titles are resolved, never typed; what belongs to an item is read-only.
- [0008-references-grant-nothing.md](0008-references-grant-nothing.md) — References grant no access and reveal nothing unreadable.
- [0009-operator-authority.md](0009-operator-authority.md) — Separate operator authority; step-up for sensitive actions.
- [0010-one-verification-flow.md](0010-one-verification-flow.md) — One email-verification flow with purposes; actions resume for their owner.
- [0011-toolchain.md](0011-toolchain.md) — Toolchain: Bun, Biome, reviewed Prisma migrations.
- [0012-bulk-import-through-reviewed-drafts.md](0012-bulk-import-through-reviewed-drafts.md) — Bulk import through reviewed drafts.
- [0013-permission-roles-and-display-labels.md](0013-permission-roles-and-display-labels.md) — Permission roles are stable; display labels are chosen per surface.
