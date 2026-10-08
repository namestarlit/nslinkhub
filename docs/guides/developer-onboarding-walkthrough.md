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

**Pin:** verified against commit `97060ad`. This is enforced, not honor
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
bun install              # prisma generate (postinstall) + wires the pre-push verify hook
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
[verification.md](../runbooks/verification.md) (boundaries, local documentation links,
this guide's freshness pin, typechecks, format/lint, tooling/email tests,
build, unit tests, isolated database lifecycle checks and e2e).

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
the product (the PRD); [ARCHITECTURE.md](../../ARCHITECTURE.md) is the
system-architecture authority; [DESIGN.md](../../DESIGN.md) is the visual
system; `docs/design-docs/` are focused designs (map: [docs/README.md](../README.md));
[engineering decisions](../engineering-decisions/README.md) record settled
foundations; `CHANGELOG.md` is what
happened, in order.

Read, in this order:

1. [PRODUCT.md](../../PRODUCT.md) — end to end. Hold: one hub per user
   (Drive-style sharing); collections are independent; references grant no
   access to their destinations; a resource's kind is
   set by *how it was added*, never URL inspection; tags are plain arrays;
   sharing = link / direct / publish; export reads like a Google Doc;
   sign-in is code-first; account handover = double-verified email change.
2. [ARCHITECTURE.md](../../ARCHITECTURE.md) — the domain model, codemap,
   runtime and architectural invariants.
3. [tenancy-and-access.md](../design-docs/tenancy-and-access.md) — the access
   model (owner → direct share → active link → published, independently per
   collection) — and [identity-and-handles.md](../design-docs/identity-and-handles.md)
   for handles and the Web URL scheme (`/c/<id>` permalink vs
   `/@handle/<slug>` pretty URL).
4. [AGENTS.md](../../AGENTS.md) § Non-Negotiable Invariants — all of them.

**Checkpoint 2** — answer in your own words:

- [ ] Why does `/c/<id>` survive a slug rename and a transfer while
      `/@handle/<slug>` may not?
- [ ] Why does adding a collection reference never grant destination access?
- [ ] Why does a route never carry `hubId` on writes?
- [ ] What are the four access sources, and why do references not propagate them?

---

## Session 3 — Walk The Product Over Curl

Goal: every core capability exercised by hand. API running (`bun run dev`).

```bash
# Request a code. For real mail, configure Resend and run the email worker
# (see local-development.md); this intentionally sends to your own mailbox.
curl -si localhost:4000/api/v1/auth/code/send \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com"}'
# Enter the received code; first verification creates the account and hub.
curl -si localhost:4000/api/v1/auth/code/verify \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","code":"<received-code>","name":"Paul"}' \
  | grep -i set-auth-token
export T="<token>"

# Profile is the client entry point: displayName, handle, hubId
curl -s localhost:4000/api/v1/profile -H "Authorization: Bearer $T" | jq

# Create two independent collections, then add a reference
curl -s localhost:4000/api/v1/collections -H "Authorization: Bearer $T" \
  -H 'content-type: application/json' \
  -d '{"slug":"se-guide","title":"Software Engineering"}' | jq .data.id
curl -s localhost:4000/api/v1/collections -H "Authorization: Bearer $T" \
  -H 'content-type: application/json' \
  -d '{"slug":"essentials","title":"Essentials"}' | jq .data.id
export GUIDE="<id1>" TARGET="<id2>"
curl -s localhost:4000/api/v1/collections/$TARGET/resources/external \
  -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"url":"https://roadmap.sh","position":0,"tags":["Tool"]}' | jq .data.tags
curl -s localhost:4000/api/v1/collections/$GUIDE/resources/collection \
  -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d "{\"linkedCollectionId\":\"$TARGET\",\"position\":0}" | jq
# Tags come back lowercased. Reuse/cycles are allowed; permissions stay independent.

# Publish → discovery → the URL-scheme reads
curl -s -X POST localhost:4000/api/v1/collections/$GUIDE/publish \
  -H "Authorization: Bearer $T" > /dev/null
curl -s localhost:4000/api/v1/discover | jq '.data[].slug'
curl -s localhost:4000/api/v1/hubs/by-handle/paul | jq .data.hub
curl -s localhost:4000/api/v1/collections/$GUIDE | jq .data.slug     # permalink
curl -s localhost:4000/api/v1/collections/$TARGET | jq .error.code # not_found: target is still private

# Link sharing: enable, note the ONE-TIME token, read anonymously with ?s=
curl -s -X PUT localhost:4000/api/v1/collections/$GUIDE/link-sharing \
  -H "Authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"enabled":true}' | jq
curl -s "localhost:4000/api/v1/collections/$GUIDE?s=<token>" | jq .data.title

# Export: the response IS the file (-OJ honors Content-Disposition)
curl -s -OJ localhost:4000/api/v1/exports -H "Authorization: Bearer $T" \
  -H 'content-type: application/json' \
  -d "{\"format\":\"pdf\",\"collectionIds\":[\"$GUIDE\"],\"expand\":true}"
ls *.pdf   # open it: H1 guide, H2 section, hyperlinked lines
# Default expand:false keeps references as links. Explicit expansion stops after
# one reference level; every target is authorized. Two collectionIds → a zip.

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
curl -s localhost:4000/api/v1/discover | jq '.data | length'   # still serves
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
   independent grant checks slowly; note `requireRead` throws 404, not 403.
4. [collections.service.ts](../../apps/api/src/modules/collections/collections.service.ts)
   — find `readCollectionView` (permalink + slug reads share it) and
   resource references (each destination is authorized separately).
5. [SECURITY.md](../SECURITY.md) — all of it, especially § Origins, CORS,
   and CSRF (why *no* CORS config is deliberate and complete).

**Checkpoint 4**:

- [ ] Why 404 instead of 403 for a collection you cannot read?
- [ ] Why may a reference in a readable collection have an unavailable target?
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

E2E now creates, migrates and drops a disposable database per run. Run
`bun run verify` with local services available; inspect failing suites and
connectivity rather than resetting development data. Read
[verification.md](../runbooks/verification.md) for test-specific configuration
and [release.md](../runbooks/release.md) for the separate image rehearsal.
Migrations start from a single squashed `0_init` (pre-deployment). If your
development DB predates it, reset it and load the curated demo content
([local-development.md](../runbooks/local-development.md) § Resetting Local Data,
then `bun run db:seed`).

**Checkpoint 5**:

- [ ] What is the three-step config resolution order in dev?
- [ ] What exactly refuses to boot in production, and why is the dev default
      auth secret rejected even when present?
- [ ] How does e2e isolate its database, and what cleanup can SIGKILL prevent?

---

## Session 6 — W3 Direction And The Gate

Goal: everything the web track has already decided, then the go/no-go gate.

Read:

1. [identity-and-handles.md](../design-docs/identity-and-handles.md) § Web URL
   scheme and § Identity (code-first sign-in; the four-step double-verified
   email change).
2. [transactional-email.md](../design-docs/transactional-email.md) — the
   built template trio, encrypted outbox, separate worker and locally verified
   delivery path; distinguish these from live provider acceptance. Then open
   [code-email.tsx](../../packages/email/src/code-email.tsx) — the shared
   base all three templates render through.
3. [design-docs/README.md](../design-docs/README.md) — the two `web-*` design
   documents (experience, interface system) and [DESIGN.md](../../DESIGN.md),
   the canonical theme tokens.
4. [adoption-decisions.md](../design-docs/adoption-decisions.md) — the
   foundation comparison and gates: isolated verification and safe typed
   contracts now implemented before web work; auth delivery with the code-first journey;
   observability and deployment acceptance before public release.

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
- [ ] You can distinguish locally verified code delivery from the account
      journey's browser and live-provider acceptance, and explain why Impeccable may restyle
      but not reorder that journey.
- [ ] You can name the foundation checks required before web implementation
      and the separate public-release gates.
- [ ] `bun run verify` is green on your machine right now.

The foundation, backend auth delivery, W3 design and first web reading journey
are committed. Read the [pinned auth integration evidence](../design-docs/auth-delivery-integration.md)
for the codes-only decision and the transaction-scoped integration that closes
native delivery and email-change gaps. Profile credential writes and account
deletion are disabled; password authentication has been removed.
The reviewed backend auth-delivery implementation is committed and its source
verification gate passes; see the
[completed auth-delivery plan](../exec-plans/completed/prove-auth-delivery-boundary.md).
The first W3 discover-to-resource journey is reviewed and committed. The
[public hub/pretty-URL reading journey](../exec-plans/completed/deliver-public-hub-reading.md)
is implemented and reviewed. The
[service-status journey](../exec-plans/completed/deliver-service-status.md) is
implemented and reviewed. [Service operations](../design-docs/service-operations.md)
(separate operator authority, account restrictions, public-content holds and
audit; never private collection access) and the unified web experience
(one visual system, comments, notifications, saving one or two links with
resolved titles and tags) are reviewed and committed, as is the operations
redesign (tabbed tables, collection review by link, "Confirm it's you" for
sensitive actions) and one reusable email-verification flow that resumes
interrupted actions for their owner. Settled foundations are recorded in
[engineering decisions](../engineering-decisions/README.md). The docs follow
the PRODUCT / ARCHITECTURE / DESIGN layout. Next: the
link-metadata foundation, activity and attribution, the Manage workspace,
[bulk import](../exec-plans/active/deliver-bulk-import.md), your home and
following, then preview cards (the full order is `PRODUCT.md` §9) and the
[final internals pass](../exec-plans/active/final-pass-internals.md).
Continue with one complete vertical MLP journey at a time.
Local PostgreSQL/Redis run in containers; the API,
worker and Next.js dev server run on the host. Keep application builds
and tests in `bun run verify`; fresh Docker image acceptance belongs to
[deployment preparation](../runbooks/release.md), not the W3 readiness gate.
Apply Impeccable to interface work under repository guidance, then prove the
account journey through the web origin.

---

## Appendix A — Wider Reading Map (only when a task needs it)

- API/persistence casing and the response envelope →
  [conventions.md](../design-docs/conventions.md)
- Idempotency, concurrency, jobs, data rules →
  [RELIABILITY.md](../RELIABILITY.md)
- Engineering principles → [CORE_BELIEFS.md](../CORE_BELIEFS.md)
- ns-series single sign-on (nsauth, a centralized IAM) →
  [identity-sso.md](../design-docs/identity-sso.md)
- Observability direction (LogTape/Sentry + shared Alloy) →
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
| `bun run dev` | infra up + API/worker watchers + Next.js on :3000 |
| `bun run infra:up` / `infra:down` | local PostgreSQL + Redis |
| `bun run api:dev` / `api:test` | single-service loop / API tests |
| `bun run email:test` | email template tests |
| `bun run verify` | API/web builds, types, boundaries and source/integration tests |
| `bun run test:browser` | production browser journey with isolated API/data fixtures |

Cleanup after the walkthrough:

```bash
rm -f *.pdf *.md.download /tmp/links.csv   # exported/downloaded artifacts
bun run infra:down                         # stop local services
```

The walkthrough account and collections live only in the disposable dev
database. For intentional cleanup use the local-development runbook;
verification never requires resetting that data.
