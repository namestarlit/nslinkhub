# ADR-0007: Link titles are resolved, never typed; what belongs to an item is read-only

**Status:** accepted  
**Date:** 2026-10-07

## Context

Typed titles drift from the real page and add input friction; editable addresses
and titles make a saved link no longer the thing that was saved.

## Options considered

- Editable title and URL
- Server-resolved title; address, title, target and heading text fixed once saved

## Decision

A link's title comes from its page (`og:title`/`<title>`, YouTube via oEmbed),
looked up server-side with SSRF guards; no add or edit endpoint accepts a title.
What belongs to an item — a link's address and title, a reference's target, a
heading's text — never changes after saving. People edit only what they add:
tags, order, and (planned) notes. A wrong link is removed and added again.

## Rationale

- Inputs are only what people truly have to type.
- Personal context belongs in a note, not a rewritten title.

## Constraints to preserve

- Add/edit DTOs have no title field for links or references; edits accept tags and position only.
- Resolved titles never block a save; lookups run after commit.
- Known exception, open for review: imports keep the title from the source file
  (bookmark text or a CSV `title` column). Resolving them like other saves would
  supersede this note, not the decision.

## Links

- [collections-and-resources.md](../design-docs/collections-and-resources.md)
- [PRODUCT.md](../../PRODUCT.md)
