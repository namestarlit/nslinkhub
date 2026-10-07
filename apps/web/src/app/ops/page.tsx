import type { OperatorAccount, SessionView } from "@nslinkhub/types";
import type { Metadata } from "next";
import { FormNotice } from "../../components/form-notice";
import { OperatorFailure } from "../../components/operator-failure";
import { OperatorNav, QuickAction } from "../../components/operator-ui";
import { type ApiPath, queryValue } from "../../lib/http";
import { operatorRead } from "../../lib/operator-read";
import { openSearch } from "../../lib/ops-search";
import { serverRead } from "../../lib/server-api";
export const metadata: Metadata = { title: "Accounts · Service operations" };
export const dynamic = "force-dynamic";

const role = (a: OperatorAccount) => (a.admin ? "Admin" : a.operator ? "Operator" : "Member");

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const sealed = queryValue(query.s) ?? "";
  const q = openSearch(sealed);
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const cursor = queryValue(query.cursor);
  if (cursor) params.set("cursor", cursor);
  const [result, session] = await Promise.all([
    operatorRead<OperatorAccount[]>(
      `/api/v1/operations/accounts${params.size ? `?${params}` : ""}` as ApiPath,
      "/ops",
    ),
    serverRead<SessionView>("/api/v1/session"),
  ]);
  if (!result.ok) return <OperatorFailure error={result} />;
  const me = session.ok ? session.data : null;
  const here = `/ops${q ? `?${new URLSearchParams({ s: sealed })}` : ""}`;
  // The same rule as the account page: admins manage everyone; operators manage
  // members and themselves. Nobody suspends their own account.
  const manages = (a: OperatorAccount) =>
    !!me && (me.admin || (!a.operator && !a.admin) || me.userId === a.id);
  return (
    <section className="reader ops-page">
      <OperatorNav current="accounts" />
      <h1>Accounts</h1>
      <p className="meta">Find people by email or hub handle. Every action is recorded.</p>
      <FormNotice code={queryValue(query.notice)} />
      <form method="post" action="/forms/ops-search" className="ops-filters">
        <input type="hidden" name="page" value="accounts" />
        <label className="ops-search">
          <span className="sr-only">Email or hub handle</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={254}
            placeholder="Email or @handle"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="button">
          Search
        </button>
        {q && (
          <a href="/ops" className="ops-clear">
            Clear
          </a>
        )}
      </form>
      {result.data.length ? (
        <table className="ops-table">
          <caption className="sr-only">
            {q ? `Accounts matching ${q}` : "Accounts, newest first"}
          </caption>
          <thead>
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Hub</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((a) => (
              <tr key={a.id}>
                <td data-label="Account">
                  <a href={`/ops/accounts/${a.id}`} className="ops-primary">
                    {a.name || "Unnamed account"}
                  </a>
                  <span className="ops-secondary">{a.email}</span>
                </td>
                <td data-label="Hub">{a.hub ? `@${a.hub.handle}` : "—"}</td>
                <td data-label="Role">{role(a)}</td>
                <td data-label="Status">
                  <span className={`ops-status ${a.state}`}>
                    {a.state === "active" ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="ops-actions">
                  {manages(a) && !a.admin && me?.userId !== a.id && (
                    <QuickAction
                      action={a.state === "suspended" ? "account.reactivate" : "account.suspend"}
                      targetId={a.id}
                      version={a.version}
                      label={a.state === "suspended" ? "Reactivate" : "Suspend"}
                      returnTo={here}
                    />
                  )}
                  {manages(a) && a.sessions > 0 && (
                    <QuickAction
                      action="sessions.revoke"
                      targetId={a.id}
                      version={a.version}
                      label="Sign out everywhere"
                      returnTo={here}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">{q ? `No account matches “${q}”.` : "No accounts yet."}</p>
      )}
      {result.meta?.nextCursor && (
        <p>
          <a
            className="button"
            href={`/ops?${new URLSearchParams({ ...(q ? { s: sealed } : {}), cursor: result.meta.nextCursor })}`}
          >
            More accounts
          </a>
        </p>
      )}
    </section>
  );
}
