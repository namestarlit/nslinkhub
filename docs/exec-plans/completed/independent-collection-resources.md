# Independent collections and guide resources

## Purpose / Big Picture

Collections are independent access/ownership units. An ordered resource can be an
external link, a reference to another collection, or a heading. References never
grant access, transfer/delete targets, or forward share tokens. Exports optionally
expand readable references once and explicitly mark unavailable references.

## Progress

- [x] (2026-10-07) Inspect current hierarchy and the disposable Markdown export.
- [x] (2026-10-07) Replace structural hierarchy with independently authorized resource references.
- [x] (2026-10-07) Add heading resources and bounded guide exports; update web reader.
- [x] (2026-10-07) Review/apply preserving migration and update contracts/documentation/tests.
- [x] (2026-10-07) Run repository gate; check guide exports in all formats and visually inspect PDF.
- [x] (2026-10-07) Complete production browser regression: 36 pass, 0 fail, including unavailable collection sign-in.

## Surprises & Discoveries

The supplied Markdown combines headings at levels 1–3, prose and many external
links. Sections often serve document organisation, not separate sharing units.
It remains in ignored ref/; no personal source content enters committed fixtures.
Existing references are stored twice: parentCollectionId and a resource pointer.
Existing linked-target deletion cascades to reference resources; replace with
SET NULL so a missing target is visible as unavailable without deleting content.

A later-page cursor initially overwrote the hold filter's OR clause. Use an
AND group for cursor and availability conditions; a regression exercises a held
collection between two visible rows.

Expanded export coverage exceeded the shared export request budget. Reset the
disposable database's budget between scenarios, keeping production limits intact.
The cyclic guide PDF was rendered and visually checked: heading levels and link
order are preserved; cycles remain links instead of causing recursive output.

## Decision Log

- 2026-10-07: User approved removing hierarchy. Remove old nest/children endpoints
  and parent wire field rather than keeping compatibility aliases.
- References use immutable linkedCollectionId; may cross hubs when the adding
  editor can read the target. Multiple referring collections and cycles are valid.
  No permission inheritance, token propagation or recursive transfer/deletion.
- Heading resources are ordered labels, not collections. No full rich-text editor
  or Markdown seed import in this milestone; review the export's structure only.
- Explicit expand:true exports expand one reference level; default exports keep
  links. Further references remain links. Every resolved target is authorized;
  unavailable destinations get a generic notice without private title/description.
- Migration keeps collections/resources and independent grants. Inherited access
  ceases. No inherited grants or holds are carried forward.
  User confirmed the database will be wiped; implement no relationship/grant
  backfills or compatibility paths.

- 2026-10-07: User approved friendly unavailable collection screens with Sign in
  for signed-out readers, preserving the destination. Keep API private/missing
  equivalence; no access-request workflow in this milestone. URL recognition with
  an explicit reference choice was recommended, not implemented as auto-detection.

## Outcomes & Retrospective

Independent references, heading resources, bounded exports and the unavailable
screen are implemented. `bun run verify` passes in an isolated checkout against
a disposable database. `bun run test:browser` passes all 36 production-browser
tests (430 assertions), including independent reference visibility and signed-out
return destinations with and without JavaScript. The mobile unavailable screen
and generated guide PDF were visually checked.

No seed import or database wipe was performed; the supplied export remains intact.
Automatic recognition of pasted collection URLs, the web creation controls for
headings/references and a request-access approval workflow remain future work.
The API supports explicit reference and heading creation now.

## Context And Orientation

The original CollectionsService and CollectionPolicyService owned tree mutations,
ancestor grants and subtree transfer. ResourcesService also mutated parents on
reference deletion, while ExportsService assumed sections contained only external
links. These paths are now removed. ResourcesService resolves reference metadata
for each viewer; ExportsService authorizes each destination before expansion.
The Next CollectionReader consumes resources directly without a children request.
CollectionFeedback provides the unavailable state and safe sign-in return route.

## Plan Of Work

Update schema, policy, resources, collection lifecycle and types together. Replace
hierarchy migration constraints deliberately while retaining UUID/time triggers.
Update exports and reader. Replace hierarchy tests with independence/privacy
coverage, preserving transfer/moderation tests. Update authoritative product and
security contracts, then verify isolated builds and disposable test databases.

## Concrete Steps

Run bun run check, bun run verify in isolated checkout; production browser tests.
Generate migration with bunx prisma migrate dev --create-only on a disposable
migrated DB; review SQL, add resource checks, apply locally.

## Validation And Acceptance

Sharing/publishing A does not grant B access through a reference. Cross-hub readable
references work; inaccessible titles are not serialized. Reordering/deleting A's
resources does not require B write access. Transfer/delete affects A only. Cycles
cannot cause recursive exports. Heading order survives all three export formats.
Old structural endpoints are absent. No compatibility or relationship backfills are introduced.

## Idempotence And Recovery

Forward migration preserves resource content and independent grants; no reset.
Use disposable databases for tests. Keep raw personal exports ignored. No commit,
push or external publication in this milestone.

## Artifacts And Notes

Source reviewed: ref/CL_TOOLKIT.md; durable findings summarized above.
Disposable verification evidence: /tmp/independent-verify.log,
/tmp/independent-browser.log, /tmp/independent-guide.pdf and
/tmp/unavailable-collection-signed-out.png. Builds ran in isolated checkouts
to avoid interfering with the active development server.

## Interfaces And Dependencies

Backend owns access. Clients use packages/types only. Add collection-reference
and heading creation under /collections/:id/resources, retaining external-link
creation. Resource linkedCollection metadata is viewer-filtered. Public URLs use
immutable IDs; export URLs use configured web origin.
