import type { OperatorCollection } from "@nslinkhub/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormNotice } from "../../../components/form-notice";
import { LocalTime } from "../../../components/local-time";
import { OperatorFailure } from "../../../components/operator-failure";
import { OperatorNav, QuickAction } from "../../../components/operator-ui";
import { type ApiPath, queryValue } from "../../../lib/http";
import { operatorRead } from "../../../lib/operator-read";
export const metadata: Metadata = { title: "Collections · Service operations" };
export const dynamic = "force-dynamic";

const reason = (r: string | null) => (r ? r.replaceAll("_", " ") : "—");

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const link = queryValue(query.link)?.trim().slice(0, 2048) ?? "";
  // A pasted link opens that collection's review page directly.
  if (link) {
    const found = await operatorRead<OperatorCollection | null>(
      `/api/v1/operations/collections/resolve?${new URLSearchParams({ link })}` as ApiPath,
      "/ops/collections",
    );
    if (found.ok && found.data) redirect(`/ops/collections/${found.data.id}`);
    if (!found.ok) return <OperatorFailure error={found} />;
  }
  const held = await operatorRead<OperatorCollection[]>(
    "/api/v1/operations/collections",
    "/ops/collections",
  );
  if (!held.ok) return <OperatorFailure error={held} />;
  return (
    <section className="reader ops-page">
      <OperatorNav current="collections" />
      <h1>Collections</h1>
      <p className="meta">Review public collections and the ones held from view.</p>
      <FormNotice code={queryValue(query.notice)} />
      <form method="get" action="/ops/collections" className="ops-filters">
        <label className="ops-search">
          <span className="sr-only">Collection link</span>
          <input
            type="search"
            name="link"
            defaultValue={link}
            maxLength={2048}
            placeholder="Paste a collection link"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="button">
          Review
        </button>
      </form>
      {link && (
        <p className="form-notice error" role="status">
          No public or held collection matches that link. Paste the address from the browser or the
          Share link.
        </p>
      )}
      <h2 className="ops-section-title">On hold</h2>
      {held.data.length ? (
        <table className="ops-table">
          <caption className="sr-only">Collections held from public view</caption>
          <thead>
            <tr>
              <th scope="col">Collection</th>
              <th scope="col">Hub</th>
              <th scope="col">Reason</th>
              <th scope="col">Since</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {held.data.map((c) => (
              <tr key={c.id}>
                <td data-label="Collection">
                  <a href={`/ops/collections/${c.id}`} className="ops-primary">
                    Review
                  </a>
                  <span className="ops-secondary ops-id">{c.id}</span>
                </td>
                <td data-label="Hub">{c.hubHandle ? `@${c.hubHandle}` : "—"}</td>
                <td data-label="Reason">{reason(c.reason)}</td>
                <td data-label="Since">{c.updatedAt ? <LocalTime at={c.updatedAt} /> : "—"}</td>
                <td className="ops-actions">
                  <QuickAction
                    action="collection.release"
                    targetId={c.id}
                    version={c.version}
                    label="Release"
                    returnTo="/ops/collections"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">Nothing is on hold.</p>
      )}
    </section>
  );
}
