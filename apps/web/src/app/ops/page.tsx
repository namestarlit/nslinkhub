import type { OperatorAccount } from "@nslinkhub/types";
import type { Metadata } from "next";
import { FormNotice } from "../../components/form-notice";
import { NativeForm } from "../../components/native-form";
import { OperatorFailure } from "../../components/operator-failure";
import { OperatorNav } from "../../components/operator-ui";
import { queryValue, withCursor } from "../../lib/http";
import { operatorRead } from "../../lib/operator-read";
export const metadata: Metadata = { title: "Service operations" };
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const result = await operatorRead<OperatorAccount[]>(
    withCursor("/api/v1/operations/accounts", queryValue(query.cursor)),
    "/ops",
  );
  if (!result.ok) return <OperatorFailure error={result} />;
  return (
    <section className="reader">
      <OperatorNav />
      <h1>Service operations</h1>
      <p className="meta">
        Account access and public-content moderation. Every action is recorded.
      </p>
      <FormNotice code={queryValue(query.notice)} />
      <NativeForm action="/forms/account-lookup">
        <label htmlFor="lookup">Find an account by email, user ID or hub handle</label>
        <input id="lookup" name="lookup" maxLength={254} required autoComplete="off" />
        <button type="submit" className="button">
          Find account
        </button>
      </NativeForm>
      <h2 className="list-heading">Accounts</h2>
      <ul className="collection-list">
        {result.data.map((account) => (
          <li className="collection-row" key={account.id}>
            <h2>
              <a href={`/ops/accounts/${account.id}`}>{account.name || "Unnamed account"}</a>
            </h2>
            <p>{account.email}</p>
            <div className="row-meta">
              <span>{account.state === "active" ? "Active" : "Suspended"}</span>
              {account.hub && <span>@{account.hub.handle}</span>}
              {account.admin && <span>Service admin</span>}
              {!account.admin && account.operator && <span>Service operator</span>}
            </div>
          </li>
        ))}
      </ul>
      {!result.data.length && <p className="empty">No accounts on this page.</p>}
      {result.meta?.nextCursor && (
        <p>
          <a className="button" href={`/ops?cursor=${encodeURIComponent(result.meta.nextCursor)}`}>
            More accounts
          </a>
        </p>
      )}
      <section className="operation-section">
        <h2>Review a public collection</h2>
        <p>Enter its immutable collection ID from the copied collection link.</p>
        <NativeForm action="/forms/collection-lookup">
          <label htmlFor="collectionId">Collection ID</label>
          <input id="collectionId" name="collectionId" required maxLength={36} />
          <button type="submit" className="button">
            Review collection
          </button>
        </NativeForm>
      </section>
    </section>
  );
}
