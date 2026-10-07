import type { OperatorAuditEntry } from "@nslinkhub/types";
import type { Metadata } from "next";
import { LocalTime } from "../../../components/local-time";
import { OperatorFailure } from "../../../components/operator-failure";
import { OperatorNav } from "../../../components/operator-ui";
import { type ApiPath, queryValue } from "../../../lib/http";
import { operatorRead } from "../../../lib/operator-read";
export const metadata: Metadata = { title: "Operator audit" };
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams,
    filters = new URLSearchParams({ limit: "20" });
  for (const key of ["actor", "target", "action", "from", "to", "cursor"]) {
    const value = queryValue(query[key]);
    if (value)
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
  if (result.meta?.nextCursor) next.set("cursor", result.meta.nextCursor);
  return (
    <section className="reader">
      <OperatorNav />
      <h1>Operator audit</h1>
      <p>Actions and access records from the last 365 days.</p>
      <form method="get" className="audit-filters">
        {["actor", "target", "action"].map((key) => (
          <label key={key}>
            {key === "actor"
              ? "Actor user ID"
              : key === "target"
                ? "Target user, collection or invitation ID"
                : "Action"}
            <input name={key} defaultValue={queryValue(query[key]) ?? ""} maxLength={40} />
          </label>
        ))}
        <label>
          From
          <input
            name="from"
            type="date"
            defaultValue={queryValue(query.from)?.slice(0, 10) ?? ""}
          />
        </label>
        <label>
          To
          <input name="to" type="date" defaultValue={queryValue(query.to)?.slice(0, 10) ?? ""} />
        </label>
        <button type="submit" className="button">
          Apply filters
        </button>
        <a href="/ops/audit">Clear filters</a>
      </form>
      <ol className="collection-list">
        {result.data.map((event) => (
          <li className="collection-row" key={event.id}>
            <h2>{event.action.replaceAll(".", " · ")}</h2>
            <p>
              {event.outcome.replaceAll("_", " ")}
              {event.reason ? ` · ${event.reason.replaceAll("_", " ")}` : ""}
            </p>
            <dl className="account-details">
              <dt>When</dt>
              <dd>
                <LocalTime at={event.createdAt} />
              </dd>
              <dt>Actor</dt>
              <dd>{event.actorUserId ?? event.authority ?? "Deployment"}</dd>
              {(event.targetUserId || event.collectionId || event.invitationId) && (
                <>
                  <dt>Target</dt>
                  <dd>{event.targetUserId ?? event.collectionId ?? event.invitationId}</dd>
                </>
              )}
              {event.afterState && (
                <>
                  <dt>Change</dt>
                  <dd>
                    {event.beforeState} → {event.afterState}
                  </dd>
                </>
              )}
            </dl>
          </li>
        ))}
      </ol>
      {!result.data.length && <p className="empty">No events match these filters.</p>}
      {result.meta?.nextCursor && (
        <a className="button" href={`/ops/audit?${next}`}>
          Older events
        </a>
      )}
    </section>
  );
}
