# Web interface system

Status: W3 interface contract. Explore/hub/pretty-URL/permalink reading is implemented;
other journeys retain their own browser acceptance.
The [experience](web-product-experience.md) owns journeys and copy direction;
[tokens](web-design-tokens.md) own all concrete theme values.

## Layout and hierarchy

Use a compact top bar and centered content; add a status destination when its
complete journey ships.
The collection is the main reading surface. Explore and hub views use a single
list with separators; no nested cards, dashboard metrics or decorative covers.
The collection title and resource titles provide the visual hierarchy.

Desktop page gutter is 32 px and the shell stops at 1120 px. Reading content
stops at 768 px, with prose capped at 70 characters. Below 640 px use 20 px
gutters and stack the title/action group. The shell must fit 320 px without
horizontal scrolling. At 1024 px a collection may place its section navigation
beside the reader; the DOM reading order remains title, description, navigation,
resources. No fixed mobile bottom bar in this slice.

All routes have a skip-to-content link, one `h1`, a labelled main region and
semantic navigation. Native links handle navigation; buttons perform actions.
Do not make a row containing secondary controls into one enclosing link.

## Component vocabulary

| Component | Required behavior |
| --- | --- |
| Collection row | Title is the main link; description and metadata wrap. Tags are text until actual filtering exists. Hover changes the row surface; focus stays visibly attached to the link. |
| Resource row | One primary destination, hostname and optional tags. External links use normal browser behavior and a no-referrer policy. No script/data URL navigation. |
| Section row | Distinct section label and authorized title; links to the immutable child ID. Pending contextual data uses a neutral label, never stale private text. |
| Button | Filled accent for the primary action, bordered neutral for secondary, text for low emphasis. Minimum 44 px hit area. Default/hover/focus/active/disabled/pending states share geometry. |
| Copy link | Explicit button; announces “Link copied” without moving focus. On clipboard failure reveal selectable text and “Copy this link”. Never toast raw exception text. |
| Pagination | Visible continuation control with pending state and result-count announcement; prevent duplicate loads; preserve existing results on a retryable page failure. |
| Feedback panel | Heading, short explanation, one recovery action. Errors use icon/text plus color. Request ID is optional expandable support detail, not the headline. |
| Skeleton | Match the title/list geometry. Mark the region busy; decorative skeletons are hidden from assistive technology. No content hidden awaiting animation. |
| Future input | Persistent label, instructions and inline error linked with `aria-describedby`; preserve entered values on retryable failure. |

Use one consistent stroke-icon family or simple standard glyphs with accessible
names. Icons supplement text. Do not invent symbolic labels for unfamiliar
actions. No animation on first page load; use short transitions only for focus,
hover and feedback. Reduced motion makes transitions immediate and removes
skeleton movement.

## State model

| Condition | Visible result | Recovery |
| --- | --- | --- |
| Initial document | Complete uncached server render, bounded by API deadlines | Results or feedback work without JavaScript |
| Document navigation/revalidation | Hide previous content and show page-shaped loading feedback with a "Reload this page" action | Fresh server authorization before rendering; cancelled navigation remains recoverable |
| Empty successful list | Context-specific empty copy | Existing navigation only |
| More results loading | Existing rows stay, continuation disabled/busy | Append and announce |
| Next page fails | Existing rows stay; inline feedback at continuation | Retry the same cursor |
| Invalid cursor | Explain that the list changed | Reload the first page |
| Anonymous/unauthorized collection | Indistinguishable unavailable page | Explore; sign-in only when shipped |
| Expired authenticated session | Clear private content and cached identity | Working sign-in journey with safe local return URL |
| Revoked share/unpublished collection | Remove formerly visible content on revalidation failure | Unavailable page |
| 429 | Brief retry message honoring `Retry-After` | Manual retry after the wait |
| Timeout/offline/5xx | Bounded failure with retry and retained public shell | One deliberate retry, no automatic loop |
| Future 409 write | Keep local draft separate from fresh server state | Review changes and retry with current version |

Transient network failure must not be treated as confirmed sign-out. Do not
replace private data with another user's stale response: cancel outstanding
requests on session transitions and ignore results from the previous session
generation. Refetch on return from background/history before restoring private
content. A revocation cannot erase a resource already read by a person; the
acceptance concerns new requests and stale application/browser state.

## Runtime and HTTP boundary

Browser requests use one typed same-origin adapter under `/api/v1`; no public
API-origin environment setting, bearer storage or client imports from the API.
Normalize the product error union and raw better-auth's different protocol at
their respective adapters. UI copy branches on stable codes. Unknown codes
receive a safe fallback rather than raw remote messages.

Server reads use a server-only adapter with a configured trusted API origin,
an eight-second deadline covering headers and body, and `cache: no-store`.
The browser adapter uses a ten-second deadline and cancels on navigation or
session change. Do not automatically retry mutations. Construct paths from encoded, validated
route parameters. Never derive the upstream origin from request headers or a
submitted URL. Forward only the required session cookie and explicit share
token, never all incoming headers; refuse upstream redirects to prevent
credential forwarding to another host. Do not forward browser bearer tokens.
Only public non-secret configuration can cross the React/server boundary.

Start all collection, explore and hub reads uncached. Profile, shares, saved
content, tokens and access decisions never enter shared caches. Configure page
and API response cache policy explicitly, disable sensitive route prefetching,
and verify framework/browser history behavior rather than relying on defaults.
Authenticated or token-bearing reads must not appear in static output, metadata,
analytics, logs or service-worker storage. Use a restrictive referrer policy
and exclude share query strings from telemetry. Public metadata is generic
until an explicitly public, independently authorized source supplies its text.
Next.js supports explicit per-fetch `no-store`; the chosen framework version's
page/router behavior must still be verified separately. See the official
[fetch reference](https://nextjs.org/docs/app/api-reference/functions/fetch).

Share tokens remain opaque. Pass the ancestor token only to related collection
reads needed to render/navigate that shared subtree; never to discovery, public
hub links, third-party links or unrelated API routes. Retain query-token access
for anonymous section navigation without placing it in persistent client
storage. A signed-in read may record access according to the existing API;
rotation still requires fresh authorization for subsequent reads.

Same-origin routing does not prove CSRF protection. Before browser writes land,
the API must reject untrusted origins on every cookie-authenticated mutation,
including bodyless actions, multipart uploads and auth routes. Product writes
carrying a session cookie require an exact allowed `Origin`; missing and
`null` origins fail closed. A bearer header alongside a session cookie does
not bypass that check. Cookie-free direct API clients retain bearer support
without an Origin requirement; the auth guard still validates the bearer.
Auth routes retain better-auth's origin checks, including login-CSRF coverage.
Test all of these cases before shipping browser writes. Keep the raw
better-auth handler ahead of body parsing. Align `BETTER_AUTH_URL`, allowed
origins, cookies and redirects with port 3000 in local browser development;
preserve supported direct API/bearer clients. Production uses path routing on
one HTTPS origin. No CORS policy is added by implication.

Runtime configuration has separate server and browser exports. Server secrets
retain `_FILE` precedence and loud invalid-production failures. Web server
configuration may contain the internal API origin; browser configuration may
not. The implementation must add a mechanical boundary check and inspect the
production client bundle for synthetic secret canaries. Do not introduce a
dependency upgrade unrelated to scaffolding.

## Browser proof required by gate #2

Use the actual web origin and isolated API/database fixtures. Exercise explore,
hub, pretty URL, permalink and nested reads; cursor continuation; anonymous
404 equivalence; session expiry; cross-user isolation; unpublish/link rotation;
timeout and unavailable API. Check cookie issuance and browser-origin auth,
then every mutation content type including multipart before shipping writes.
Cover 409 reload/retry at the adapter and as a real browser journey when its
editing form lands. Exports require real downloaded file bytes when that
journey lands, not just a mocked success notification.

Check keyboard-only navigation and focus, 320/390/768/1280 px widths, 200% zoom,
long unbroken titles/URLs, loading, empty, failure and reduced-motion states.
Verify text contrast at least 4.5:1, large text 3:1 and meaningful control/focus
boundaries 3:1. Do not declare the design browser-verified before an app exists.

## Implemented foundation and reference adoption

`apps/web` is a separate HTTP client, including its Server Components. It imports
wire contracts from `@nslinkhub/types` and runtime config from `@nslinkhub/config`;
it never imports Prisma, Nest modules, database models or backend-owned business
logic. Database-backed browser fixtures live under `apps/api/test/browser`,
not in the web application. Backend validation and authorization remain decisive.

Following the user-requested Pigfarm comparison (`f0bab0a`), adopted separate
server/browser config exports, server-only readers, a central browser adapter,
mechanical import checks and a single host development orchestrator. Reference
paths: `docs/designs/backend-authority.md`, `docs/designs/client-surfaces.md`,
`docs/designs/frontend-foundation.md`, `docs/designs/web-rendering-and-caching.md`,
`apps/web/src/lib/api-client.ts`, and `tooling/dev.ts`. These are evidence, not
dependencies or authorization to copy organization, locale or farm rules.

Local differences are deliberate: one same-origin `/api/v1`, no public API-origin
setting, eight-second server/ten-second browser deadlines, and no shared page
or data caches. Normal document links avoid router prefetch/cache. Complete
initial SSR preserves no-JavaScript pagination; streaming Suspense initially
left the fallback page hidden without JavaScript, so these entry pages await
their reads. Enhanced pagination retains position/focus and announces results.
If a document navigation is cancelled (for example with Escape), the loading
surface keeps a keyboard-accessible reload action. It reloads the current URL
through fresh server authorization; it never simply reveals the old hidden DOM.

The dev server rewrites `/api/*` to the trusted internal API origin. Production
uses ingress path routing to the API and web separately. Both dev and production
run the web's `server.ts` entry point: it derives the source from the socket and
explicit trusted proxy hops, overwrites untrusted attribution, and signs a
short-lived proof for the API read budget. API and web share `WEB_SOURCE_SECRET`
with `_FILE` support; browser bundles receive neither secret nor proof. The
API verifies attribution only for read budgets; backend authority is unchanged.
Direct `next start` is unsupported. Browser acceptance exercises that topology using an
isolated loopback proxy and the production web build. No deployment image is
required. Next.js/React/Tailwind versions are pinned in the workspace lockfile;
Webpack resolves the shared contracts' NodeNext `.js` specifiers to TS source.

Hub continuation adapts the public `HubPage` envelope (`hub` + `collections`)
using `/hubs/:hubId`, never the owner-visible collection-list endpoint.
Invalid-cursor recovery stays on the current hub or reader; duplicate rows are
suppressed and announcements count newly appended items. Hub rows use pretty
URLs, while copied links and sections retain immutable ID URLs. Next's encoded
dynamic route parameters are decoded once before validating the literal `@`
prefix and permitted path shapes. No share token reaches public hub discovery.
