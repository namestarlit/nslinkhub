# Curator accounts

Status: direction accepted in
[ADR-0016](../engineering-decisions/0016-curator-accounts-are-the-paid-tier.md).
Billing and Curator accounts are not built. Features and pricing are decided
after the everyday product is built.

## Product boundary

The everyday library — saving, organizing, sharing, publishing, subscribing and
discussion — stays free. Professional curators opt into a **Curator account**
for tools their work needs. Existing everyday capabilities do not move behind
that tier. A Curator account upgrades an individual; it does not introduce hub
memberships, organizations or transferable hubs.

The intended audience includes educators and researchers maintaining resource
libraries, people running learning programs, community curators, and people
organizing large sets of collected links. The value to validate is sustained
curation and useful returning readership.

## Candidate additions

These are options to assess, not committed features or a pricing table:

- **Aggregate analytics:** collection views, link clicks, saves and subscriptions,
  without tracking individual readers.
- **Restricted or paid collections:** invitation-based or paid access through
  the collection policy. Entitlements, previews, cancellation, refunds and
  provider responsibilities need a separate design before implementation.
- **Larger bulk work:** higher limits or scheduled imports, while preserving
  the everyday import/export workflow.
- **Link health:** alerts for broken links. Archiving page contents is outside
  the current linked-content scope and needs an explicit scope decision.
- **API access:** scoped, revocable personal keys using the same account
  authorization and request budgets. Higher limits are a plan setting, never
  an authorization bypass.
- **AI-assisted curation:** proposed collections, sections, tags and short notes
  presented as a [reviewed import draft](bulk-import.md). People accept, edit or
  reject proposals; titles still come from pages. Provider consent, transient
  page processing, data handling, metering and attribution need a design.
- **Curator presentation:** a verified label or richer hub page, with criteria
  and any custom-domain support still to be decided.

## Validation and open decisions

Build the everyday product first. Establish whether shared collections remain
useful and whether their curators need professional tools. Choose features and
prices from that evidence; no market valuation or revenue forecast is a product
requirement. Any analytics implementation must respect the aggregate-only
privacy constraint.

Paid access is an option within this direction, not a new implemented grant or
marketplace commitment. Payment-provider selection and legal/operational terms
belong to its eventual design and release review.

See [PRODUCT.md](../../PRODUCT.md) for scope and delivery, and
[people and hubs](people-and-hubs.md) for identity and subscriptions.
