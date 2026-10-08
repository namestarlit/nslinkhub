# Monetization and valuation notes

Status: direction settled (ADR-0016, 2026-10-08): everyone's library stays
free, and professional curators pay for a **Curator account**. What it includes
and costs is decided after the everyday product is built; the rest of this
document is notes for that decision, not a plan. Figures are rough reasoning,
not market research.

## Curator accounts

Who: people for whom links are the work — educators and researchers managing a
digital library of links; people running a link-heavy learning program; a
community leader whose members get a guide of the best resources (today, a
Google Doc sent to every new member); the person who keeps a community group
supplied with links; and people gathering large sets of resources from the open
web (scraping, crawling, research datasets) who need a curation layer for them.

Candidates for what the account adds:

- **Analytics and engagement** per collection: views, link clicks, saves and
  follows, counted in aggregate only.
- **Members-only collections**: a community gets access through an invitation
  list or a join link, and later paid access — through the collection policy,
  never a bypass.
- **Bigger bulk work**: higher import limits, possibly scheduled imports.
- **Link health**: alerts when links break.
- **API access**: personal API keys with scopes, for integrations, automation
  and pulling one's own data (for example to train on it) when bulk import and
  export aren't enough. Programmatic collectors add resources at scale and use
  nslinkhub as their curation layer: tags as labels, collections to organize,
  notes for context. Keys act as the account, through the same authorization
  and per-account rate budgets as every other client, and are revocable.
  Rate limits are part of the plan: heavier work can buy higher limits sized to
  it.
- **A curator profile**: a verified label and a richer hub page.

## Starting point

A bookmark manager on its own is a crowded, cheap market. Reference prices at the
time of writing: Raindrop.io Pro about $28/year, Pinboard about $22/year; Pocket has
shut down. Competing as "another place to save links" is unlikely to sustain a paid
product.

People pay for outcomes that are hard to get elsewhere. nslinkhub's candidates:

| Outcome | Why it could carry a price | Notes |
| --- | --- | --- |
| Curated guides people follow | Ordered collections with sections, answered discussion and durable references; closer to Are.na or a course outline than to bookmarks | The core product; likely free to read, so curators are the payers |
| Link-rot protection | Keep a snapshot of each page and alert when a link dies; becomes more valuable the longer someone uses it | Strongest candidate for a paid feature |
| Bulk work | Import (bookmarks HTML, CSV), export, large collections | A natural tier boundary: Save a link takes 2 links per save, and bulk import is the upgrade path |
| Curator tools | Custom domains, view analytics, private sharing for teams or cohorts | Fits educators, bootcamps, course creators |

## Tier sketch (illustrative)

- **Free:** hub, collections, saving links (2 per save), sharing, discussion, reading.
- **Paid:** bulk import/export, link-rot snapshots and alerts, curator analytics,
  custom domains, private cohort sharing.

Keep reading and following guides free: readers are how curators' work spreads, and
the network effect lives there.

## Paid access for verified curators (idea, 2026-10-07)

Two revenue lines instead of one:

1. **Marketplace fee:** verified curators and educators charge for access to a
   collection or their whole hub (one-off or recurring), and nslinkhub keeps a
   percentage (Gumroad, Substack and Patreon sit around 10%).
2. **Subscription:** people who are not selling pay for the paid-tier features
   themselves (link-rot protection, bulk import, analytics).

Why it fits: the product is already about curated guides people follow, and the
access model already has the right shape. A purchase would be one more source of
read access in the collection policy service (owner → direct share → link →
published → **purchased**), never a bypass.

What it would take, and the open questions:

- **Verification:** who counts as a verified curator (identity, payout account,
  track record), and what happens when content disappoints buyers (refunds,
  disputes).
- **Payments and payouts:** a merchant-of-record or Connect-style provider
  handling tax/VAT, fraud and payouts; for East Africa, mobile money
  (M-Pesa) through a regional processor. This is regulated, so start with a
  provider that carries the compliance.
- **Link-level value problem:** buyers pay for curation, not for the links,
  which stay public on the web. Paid value must come from ordering, notes,
  answered discussion, updates and the curator's attention.
- **Policy and trust:** previews (the first section free), what buyers keep
  after cancelling, and how paid collections appear in Discover.

Suggested order: prove that people return to free guides first, then pilot paid
access with a few hand-picked curators before building self-serve.

## Valuation take

- **Today:** pre-revenue with no users, so the company is worth close to zero. What
  exists is the option being built, plus reusable ns-series infrastructure (identity
  and SSO direction, deployment, operations).
- **Plausible indie path:** a niche that pays, for example course creators, educators
  or bootcamps curating reading lists for learners. Rough range if it catches:
  $2k–10k monthly recurring revenue within one to two years.
- **Exit multiples:** small profitable software products typically sell for about
  3–5× annual revenue, depending on growth, churn and how much the owner is needed.

## First thing to test

Whether people who follow a shared guide come back to it. Returning readers make
curators want to keep publishing, and curators are the ones who would pay.
Instrument returning visits to shared collections before building paid features.

## Related

- `PRODUCT.md` (product definition and acceptance criteria)
- [web-product-experience.md](web-product-experience.md) (reading journeys)
