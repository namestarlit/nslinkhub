import { type OperatorAuditEntry, operatorAuditActions } from "@nslinkhub/types";
import type { Metadata } from "next";
import { LocalTime } from "../../../components/local-time";
import { OperatorFailure } from "../../../components/operator-failure";
import { OperatorNav } from "../../../components/operator-ui";
import { type ApiPath, queryValue } from "../../../lib/http";
import { operatorRead } from "../../../lib/operator-read";
import { openSearch } from "../../../lib/ops-search";
export const metadata: Metadata = { title: "Audit · Service operations" };
export const dynamic = "force-dynamic";

const groups: [string, (action: string) => boolean][] = [
  [
    "Actions",
    (a) => /^(account\.(suspend|reactivate)|sessions\.revoke|collection\.(hold|release))$/.test(a),
  ],
  ["Team", (a) => /^(invitation\.|operator\.|admin\.|account\.handover)/.test(a)],
  ["Reads", (a) => /(\.list|\.lookup|\.read|\.inspect)$/.test(a)],
  ["Denied", (a) => a.endsWith(".denied")],
];
const words = (value: string) => value.replaceAll(/[._]/g, " ");
const person = (handle: string | null, id: string | null) =>
  handle ? `@${handle}` : id ? `${id.slice(0, 8)}…` : null;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams,
    filters = new URLSearchParams({ limit: "20" });
  const sealed = queryValue(query.s) ?? "";
  const q = openSearch(sealed);
  if (q) filters.set("q", q);
  for (const key of ["action", "from", "to", "cursor"]) {
    const value = queryValue(query[key])?.slice(0, 254);
    if (!value) continue;
    if (key === "action" && !(operatorAuditActions as readonly string[]).includes(value)) continue;
    filters.set(
      key,
      (key === "from" || key === "to") && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T${key === "from" ? "00:00:00.000" : "23:59:59.999"}Z`
        : value,
    );
  }
  const result = await operatorRead<OperatorAuditEntry[]>(
    `/api/v1/operations/audit?${filters}` as ApiPath,
    "/ops/audit",
  );
  if (!result.ok) return <OperatorFailure error={result} />;
  const next = new URLSearchParams(filters);
  next.delete("limit");
  next.delete("q");
  if (q) next.set("s", sealed);
  if (result.meta?.nextCursor) next.set("cursor", result.meta.nextCursor);
  const filtered = !!q || ["action", "from", "to"].some((key) => queryValue(query[key]));
  return (
    <section className="reader ops-page">
      <OperatorNav current="audit" />
      <h1>Audit</h1>
      <p className="meta">Every operator action and read from the last 365 days.</p>
      <form method="post" action="/forms/ops-search" className="ops-filters">
        <input type="hidden" name="page" value="audit" />
        <label className="ops-search">
          <span className="sr-only">Email, @handle or id</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={254}
            placeholder="Email, @handle or id"
            autoComplete="off"
          />
        </label>
        <label>
          <select name="action" aria-label="Action" defaultValue={queryValue(query.action) ?? ""}>
            <option value="">All actions</option>
            {groups.map(([label, belongs]) => (
              <optgroup key={label} label={label}>
                {operatorAuditActions.filter(belongs).map((action) => (
                  <option key={action} value={action}>
                    {words(action)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          <input
            name="from"
            type="date"
            aria-label="From"
            defaultValue={queryValue(query.from)?.slice(0, 10) ?? ""}
          />
        </label>
        <label>
          <input
            name="to"
            type="date"
            aria-label="To"
            defaultValue={queryValue(query.to)?.slice(0, 10) ?? ""}
          />
        </label>
        <button type="submit" className="button">
          Filter
        </button>
        {filtered && (
          <a href="/ops/audit" className="ops-clear">
            Clear filters
          </a>
        )}
      </form>
      {result.data.length ? (
        <table className="ops-table">
          <caption className="sr-only">Operator audit, newest first</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Action</th>
              <th scope="col">Actor</th>
              <th scope="col">Target</th>
              <th scope="col">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((event) => {
              const target =
                person(event.targetHandle, event.targetUserId) ??
                (event.collectionId
                  ? `collection ${event.collectionId.slice(0, 8)}…`
                  : event.invitationId
                    ? `invitation ${event.invitationId.slice(0, 8)}…`
                    : "—");
              return (
                <tr key={event.id}>
                  <td data-label="When">
                    <LocalTime at={event.createdAt} />
                  </td>
                  <td data-label="Action">
                    <span className="ops-primary">{words(event.action)}</span>
                    {event.reason && <span className="ops-secondary">{words(event.reason)}</span>}
                  </td>
                  <td data-label="Actor" title={event.actorUserId ?? undefined}>
                    {person(event.actorHandle, event.actorUserId) ??
                      event.authority ??
                      "Deployment"}
                  </td>
                  <td
                    data-label="Target"
                    title={
                      event.targetUserId ?? event.collectionId ?? event.invitationId ?? undefined
                    }
                  >
                    {target}
                  </td>
                  <td data-label="Outcome">
                    {words(event.outcome)}
                    {event.afterState && (
                      <span className="ops-secondary">
                        {event.beforeState} → {event.afterState}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="empty">No events match these filters.</p>
      )}
      {result.meta?.nextCursor && (
        <a className="button" href={`/ops/audit?${next}`}>
          Older events
        </a>
      )}
    </section>
  );
}
