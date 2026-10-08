# ADR-0012: Bulk import through reviewed drafts

**Status:** accepted  
**Date:** 2026-10-08

## Context

Imports wrote every parsed row straight into one collection and reported
failures afterwards, keeping whatever title the file carried. That contradicted
resolved titles (ADR-0007), gave people no chance to fix or drop bad rows before
they landed, and forced a whole bookmarks tree into a single collection.

## Options considered

- One-shot import with a per-row report (the previous behaviour).
- Client-side preview that submits only the rows that pass.
- A server-side import draft, reviewed and then committed in steps.

## Decision

Bulk import is Save a link at scale, through a server-side **import draft**:

1. An upload (bookmarks HTML, CSV) or a pasted list becomes a draft owned by the
   account. Rows get the same canonicalization and checks as Save a link; a
   source title is never used.
2. Titles resolve in the background (the worker queue), with their own lookup
   budget, and the draft fills in as they arrive.
3. The person reviews: fixes an address in place (re-checked), drops rows,
   revalidates failures, and maps folders to destinations — sections of one
   collection, separate collections (new or existing), or skipped.
4. Importing commits the ready rows to their destinations; rows that still need
   attention stay in the draft until fixed or dropped. Drafts expire.

## Rationale

- One rule for every link that enters the product, whether one or a thousand.
- Mistakes are fixed before they reach a collection, not cleaned up after.
- Folder structure carries over as guides (sections) or splits into
  collections, so one browser export serves any arrangement.
- Network-bound title lookups never run inside the write lock or a request.

## Constraints to preserve

- No import path accepts a title; titles always come from the page.
- Nothing reaches a collection before the person chooses to import.
- Drafts are private to their account and expire; they hold only what the rows
  need (addresses, tags, folder paths, statuses), never page content.
- Destination writes go through the normal collection policy and write lock;
  importing is idempotent per row.

## Links

- [bulk-import.md](../design-docs/bulk-import.md)
- [ADR-0007](0007-resolved-titles-read-only-items.md)
