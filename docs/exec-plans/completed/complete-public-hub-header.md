# Complete the public hub header

## Purpose / Big Picture

Public hubs group the hub identity, description and sharing action, with optional
owner attribution and a total published count that excludes private collections.

## Progress

- [x] (2026-10-07) Add conditional curator attribution and verify blank-name omission.
- [x] (2026-10-07) Add authoritative published count and hub timestamps to the API and header.
- [x] (2026-10-07) Add an outlined Copy hub link action beside metadata.
- [x] (2026-10-07) Eight focused browser journeys pass, including clipboard fallback,
  public counts and absent attribution for empty/whitespace names.
- [x] (2026-10-07) `bun run verify` passed, including wire contracts and private/held collection exclusion.

## Surprises & Discoveries

Hub already stores createdAt and updatedAt. Paginated collection results are not
a total; count must use the same public visibility predicate without a cursor.

## Decision Log

- Use hub record timestamps. Private collection edits do not change this metadata.
- Attribution is omitted for empty/whitespace names; never substitute email.
- Final design refinement: use “@handle by <owner>” on one identity line,
  omit hub dates from the UI, and place Copy hub link as a text action below
  the description. The API retains hub timestamps.
- Put the published count beside its section heading and empty feedback directly
  beneath it. Header Explore and Sign in match the text-action weight.
- Count published collections visible to anonymous readers, excluding held content.

## Outcomes & Retrospective

Public hubs now show optional curator attribution, a total public collection
count and a text Copy hub link action beneath the description. Hub dates are
retained in the API but omitted from the page. Browser checks pass for
anonymous, owner and other-user sessions. `bun run verify` passed in the isolated
acceptance checkout. The public count stays consistent across pagination, and
hub timestamps match stored records. No commit or push was made.

## Context And Orientation

CollectionsService.buildHubPage constructs both ID and handle responses.
packages/types/src/hubs.ts defines the public shape; PublicHub renders it.

## Plan Of Work

Add count and ISO timestamps to the public response, show a compact wrapping
metadata line, and extend API/browser coverage and canonical docs.

## Concrete Steps

Run bun run check, bun run verify and focused browser journeys using isolated
checkouts so production verification does not disturb the live development server.

## Validation And Acceptance

Counts are totals across pagination and exclude private and held collections.
Both lookup routes agree. Creation/update values match hub records. Attribution
is absent for blank owner names. Header metadata wraps on narrow screens.

## Idempotence And Recovery

Read-only derived metadata; no migration or persistent data changes required.

## Artifacts And Notes

Final layout refinement passed `bun run verify` and three focused public-hub
browser journeys. Desktop/mobile screenshots confirm grouped identity, nearby
empty feedback and wrapping without horizontal overflow.

Prior settings refinements passed repository verification and six browser cases.

## Interfaces And Dependencies

HubSummary adds publishedCollectionCount, createdAt and updatedAt. Public count
uses availableCollections(), published=true and the immutable hub ID.
