# Developer Onboarding Walkthrough

The onboarding route for developers and coding agents new to this repository:
six hands-on sessions from zero to ready for Track W3. Repository docs remain
authoritative; this guide orders them and pairs them with hands-on work — it
never restates what a runbook, design doc, or the changelog already owns.

**How to use this guide: one session per sitting, in order, and do not read
ahead.** Each session is 30–60 minutes, tells you exactly what to do and what
to read, and ends with a checkpoint — a few questions you should be able to
answer in your own words before continuing. Reading the whole file in one go
is the failure mode this structure exists to prevent. Every file is a
clickable link.

**Pin:** verified against commit `d568530`. This is enforced, not honor
system: `check:guide-pin` (part of `bun run verify`) fails when any file this
guide links changes after the pinned commit. To clear it, reread the affected
sessions, fix any drift, and move the pin to the latest commit — in a
guide-only commit, which never re-triggers the check. `docs/exec-plans/` and
`CHANGELOG.md` are exempt by design: this guide points at them rather than
restating them.

---

## Session 1 — Make It Run (do first, read nothing yet)

Goal: a working local stack and a green verification before any theory.

```bash
bun --version            # expect 1.3.x
docker compose version
bun install              # also runs `prisma generate` (postinstall)
bun run infra:up         # PostgreSQL 18 + Redis 7
(cd apps/api && bunx prisma migrate deploy)
```

No `.env` is required — dev is zero-config: every default is in code and
agrees with [compose.yml](../../compose.yml). Anything you *do* provide is
honored (resolution: exported env var → optional `apps/api/.env` → in-code
default), so overriding a port is one `.env` line.

```bash
bun run verify           # the canonical gate — must be green
```

While it runs, skim what it does in
[verification.md](../runbooks/verification.md) (a 10-step chain: boundaries,
typechecks, format/lint, email tests, build, unit, e2e).

```bash
bun run dev              # infra (idempotent) + API watch on :4000
```

In a second terminal:

```bash
curl -s localhost:4000/api/v1/health | jq     # { status: "ok" }  (liveness)
curl -s localhost:4000/api/v1/status | jq     # postgres + redis_queue "ready"
```

Open http://localhost:4000/api/docs — Swagger for every route you will use
in Session 3.

**Checkpoint 1** — you should have observed:

- [ ] `bun run verify` green end to end.
- [ ] `/health` and `/status` return different shapes — why do both exist?
- [ ] The API runs on 4000. Which port is reserved, and for what?

---

## Session 2 — What This Product Is (the one heavy-reading session)

Goal: the product model and the invariants, from the sources of truth.

Source-of-truth hierarchy, one paragraph: [AGENTS.md](../../AGENTS.md) is the
map and the non-negotiable invariants; [PRODUCT.md](../../PRODUCT.md) defines
the product; [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) is the authoritative
architecture; [ARCHITECTURE.md](../../ARCHITECTURE.md) is the short stable
code map; `docs/design-docs/` are focused satellites; `CHANGELOG.md` is what
happened, in order.

Read, in this order:

1. [PRODUCT.md](../../PRODUCT.md) — end to end. Hold: one hub per user
   (Drive model); a collection is created standalone and **nesting is a
   separate action** (one way to nest, two levels max); a resource's kind is
   set by *how it was added*, never URL inspection; tags are plain arrays;
   sharing = link / direct / publish; export reads like a Google Doc;
   sign-in is code-first; account handover = double-verified email change.
2. [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) — especially the access model
   (owner → direct share → active link → published, **inheriting down** the
   ancestor chain), Identity and handles, and the Web URL scheme
   (`/c/<id>` permalink vs `/@handle/<slug>` pretty URL).
3. [AGENTS.md](../../AGENTS.md) § Non-Negotiable Invariants — all of them.
4. [ARCHITECTURE.md](../../ARCHITECTURE.md) — the codemap table + data flow.

**Checkpoint 2** — answer in your own words:

- [ ] Why does `/c/<id>` survive a slug rename and a transfer while
      `/@handle/<slug>` may not?
- [ ] Why is there exactly one way to nest, and what bug did the second way
      cause?
- [ ] Why does a route never carry `hubId` on writes?
- [ ] What are the four access sources, and in which direction do they
      inherit?

---

## Session 3 — Walk The Product Over Curl

Goal: every core capability exercised by hand. API running (`bun run dev`).

```bash
# Sign up; the bearer token arrives in the set-auth-token response header
curl -si localhost:4000/api/v1/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"Password123!","name":"Paul"}' \
  | grep -i set-auth-token
export T="<token>"

# Profile is the client entry point: displayName, handle, hubId
curl -s localhost:4000/api/v1/profile -H "Authorization: Bearer $T" | jq

# Create a guide + a section, then NEST (two steps by design)
curl -s localhost:4000/api/v1/collections -H "Authorization: Bearer $T" \
  -H 'content-type: application/json' \
  -d '{"slug":"se-guide","title":"Software Engineering"}' | jq .data.id
curl -s localhost:4000/api/v1/collections -H "Authorization: Bearer $T" \
  -H 'content-type: application/json' \
  -d '{"slug":"essentials","title":"Essentials"}' | jq .data.id
export GUIDE="<id1>" SECTION="<id2>"
curl -s localhost:4000/api/v1/collections/$SECTION/resources/external \
  -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"url":"https://roadmap.sh","position":0,"tags":["Tool"]}' | jq .data.tags
curl -s localhost:4000/api/v1/collections/$GUIDE/collections \
  -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d "{\"collectionId\":\"$SECTION\"}" | jq
# Note: tags came back lowercased. Now try nesting $GUIDE under a third
# collection → 400 (a collection with sections cannot itself be nested).

# Publish → discovery → the URL-scheme reads
curl -s -X POST localhost:4000/api/v1/collections/$GUIDE/publish \
  -H "Authorization: Bearer $T" > /dev/null
curl -s localhost:4000/api/v1/explore | jq '.data[].slug'
curl -s localhost:4000/api/v1/hubs/by-handle/paul | jq .data.hub
curl -s localhost:4000/api/v1/collections/$GUIDE | jq .data.slug     # permalink
curl -s localhost:4000/api/v1/collections/$SECTION | jq .data.id    # publish inherits down

# Link sharing: enable, note the ONE-TIME token, read anonymously with ?s=
curl -s -X PUT localhost:4000/api/v1/collections/$GUIDE/link-sharing \
  -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"enabled":true}' | jq
curl -s "localhost:4000/api/v1/collections/$GUIDE?s=<token>" | jq .data.title

# Export: the response IS the file (-OJ honors Content-Disposition)
curl -s -OJ localhost:4000/api/v1/exports -H "Authorization: Bearer $T" \
  -H 'content-type: application/json' \
  -d "{\"format\":\"pdf\",\"collectionIds\":[\"$GUIDE\"]}"
ls *.pdf   # open it: H1 guide, H2 section, hyperlinked lines
# Repeat with "format":"markdown","expand":false → the section collapses
# to one line. Two collectionIds → a zip.

# Import: the universal CSV, with a bad row flagged instead of failing
printf 'url,title\nhttps://xyproblem.info,The XY Problem\nnot-a-url,Bad\n' > /tmp/links.csv
curl -s localhost:4000/api/v1/imports/csv -H "Authorization: Bearer $T" \
  -F file=@/tmp/links.csv -F createCollection=true \
  -F collectionTitle=Imported -F collectionSlug=imported | jq
```

**Checkpoint 3**:

- [ ] Why is create-then-nest two API calls, and what does the UI do about
      it?
- [ ] What proves the export needed no job queue?
- [ ] What happened to the CSV's bad row?

---

## Session 4 — Break It On Purpose (failure drills + the policy trace)

Goal: see the failure modes, then read the code that decides access.

```bash
# Drill 1: degrade the queue Redis — the product keeps working
docker stop nslinkhub-redis
curl -s localhost:4000/api/v1/status | jq        # "degraded"; redis_queue "unavailable"
curl -s localhost:4000/api/v1/explore | jq '.data | length'   # still serves
docker start nslinkhub-redis
curl -s localhost:4000/api/v1/status | jq        # "ready" again

# Drill 2: existence-hiding — unpublish, then read anonymously
curl -s -X POST localhost:4000/api/v1/collections/$GUIDE/unpublish \
  -H "Authorization: Bearer $T" > /dev/null
curl -s localhost:4000/api/v1/collections/$GUIDE | jq .error.code   # not_found (not 403)
```

Now trace why, through five files (read in this order):

1. [health.service.ts](../../apps/api/src/modules/health/health.service.ts)
   — why Redis-down is `degraded`, postgres-down is `unavailable` (503).
2. [redis-queue-readiness.service.ts](../../apps/api/src/modules/health/redis-queue-readiness.service.ts)
   — a fresh non-reconnecting client per check; the API holds no standing
   Redis connection.
3. [collection-policy.service.ts](../../apps/api/src/modules/hubs/collection-policy.service.ts)
   — **the heart of the product's security.** Read `resolve()` and the
   ancestor-chain walk slowly; note `requireRead` throws 404, not 403.
4. [collections.service.ts](../../apps/api/src/modules/collections/collections.service.ts)
   — find `readCollectionView` (permalink + slug reads share it) and
   `getChildren` (why there is no per-child policy check).
5. [SECURITY.md](../SECURITY.md) — all of it, especially § Origins, CORS,
   and CSRF (why *no* CORS config is deliberate and complete).

**Checkpoint 4**:

- [ ] Why 404 instead of 403 for a collection you cannot read?
- [ ] Why is a child of a readable parent always readable — and where does
      code rely on that?
- [ ] Why does the absence of CORS configuration protect browser users, and
      what does it deliberately not protect against?

---

## Session 5 — Configuration, Secrets, And The Gate

Goal: the config contract and the verification machinery, proven live.

Read first (short):

1. [secret.ts](../../apps/api/src/config/secret.ts) +
   [env.validation.ts](../../apps/api/src/config/env.validation.ts) — the
   `_FILE` contract and the two-directional validation (present-but-malformed
   always rejected; production requires the secrets).
2. [infra-deployment.md](../design-docs/infra-deployment.md) — § Origins
   (one public origin, no CORS, ports) and the secret-contract item.

Then prove the production guard is real:

```bash
cd apps/api
NODE_ENV=production bun run start   # refuses to boot: DATABASE_URL and
                                    # BETTER_AUTH_SECRET required in production
cd ../..
```

And the e2e caveat that will eventually bite you: e2e runs against the local
dev database (accepted debt — [tech-debt-tracker.md](../exec-plans/tech-debt-tracker.md)
row "E2E test isolation"). Fixed-seed fixtures accumulate across runs; when
e2e fails strangely, reset first:

```bash
docker exec nslinkhub-postgres psql -U postgres \
  -c "DROP DATABASE nslinkhub" -c "CREATE DATABASE nslinkhub"
(cd apps/api && bunx prisma migrate deploy)
bun run verify
```

**Checkpoint 5**:

- [ ] What is the three-step config resolution order in dev?
- [ ] What exactly refuses to boot in production, and why is the dev default
      auth secret rejected even when present?
- [ ] When e2e fails strangely, what is the first move?

---

## Session 6 — W3 Direction And The Gate

Goal: everything the web track has already decided, then the go/no-go gate.

Read:

1. [SYSTEM_DESIGN.md](../SYSTEM_DESIGN.md) § Web URL scheme (W3 contract)
   and § Identity and handles (code-first sign-in; the four-step
   double-verified email change).
2. [transactional-email.md](../design-docs/transactional-email.md) — the
   built template trio and the delivery machinery that deliberately does not
   exist yet. Then open
   [code-email.tsx](../../packages/email/src/code-email.tsx) — the shared
   base all three templates render through.
3. [index.md](../design-docs/index.md) — the three `web-*` design documents
   the W3 design pass must produce (listed as Planned).

The W3 session-starter itself lives in this machine's git-ignored
`ref/w3-web-app-handoff.md` (disposable by contract — see
[reference-context.md](../runbooks/reference-context.md)); it repeats nothing
durable, it only sequences it.

**Readiness gate — start Track W3 only when every box is honest:**

- [ ] Checkpoints 1–5 all passed in your own words.
- [ ] You can state the three web URL shapes and which one share buttons
      emit.
- [ ] You can explain why the web app will have no CORS config and no
      `.env` for the API origin in dev (rewrites) or prod (path routing).
- [ ] You know which auth flow ships first on the web (password) and which
      direction is decided for later (code-first) — and why Impeccable may
      restyle but not reorder it.
- [ ] `bun run verify` is green on your machine right now.

Next action: the Impeccable design pass — three `web-*` docs, moved from
Planned to Current, **before** any `apps/web` scaffolding.

---

## Appendix A — Wider Reading Map (only when a task needs it)

- API/persistence casing and the response envelope →
  [conventions.md](../design-docs/conventions.md)
- Idempotency, concurrency, jobs, data rules →
  [RELIABILITY.md](../RELIABILITY.md)
- Engineering principles → [CORE_BELIEFS.md](../CORE_BELIEFS.md)
- nsauth / "Continue with namestarlit" SSO direction →
  [identity-sso.md](../design-docs/identity-sso.md)
- Observability direction (Pino/OTel/Grafana) →
  [observability.md](../design-docs/observability.md)
- Prisma migration discipline → [migrations.md](../runbooks/migrations.md)
- Local commands and DB reset →
  [local-development.md](../runbooks/local-development.md)
- Plan format for substantial work → [PLANS.md](../../PLANS.md)
- Accepted compromises and their revisit triggers →
  [tech-debt-tracker.md](../exec-plans/tech-debt-tracker.md)

## Appendix B — Command Reference And Cleanup

Root scripts follow `<service>:<action>`; bare `dev` is the daily
orchestrator (see `package.json` for the full set):

| Command | Does |
| --- | --- |
| `bun run dev` | infra up (idempotent) + API watch on :4000 |
| `bun run infra:up` / `infra:down` | local PostgreSQL + Redis |
| `bun run api:dev` / `api:test` | single-service loop / API tests |
| `bun run email:test` | email template tests |
| `bun run verify` | the canonical 10-step gate |

Cleanup after the walkthrough:

```bash
rm -f *.pdf *.md.download /tmp/links.csv   # exported/downloaded artifacts
bun run infra:down                         # stop local services
```

The walkthrough account and collections live only in the disposable dev
database; reset it any time (Session 5).
