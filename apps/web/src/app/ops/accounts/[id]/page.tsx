import type { OperatorAccount, SessionView } from "@nslinkhub/types";
import type { Metadata } from "next";
import { FormNotice } from "../../../../components/form-notice";
import { InvitationAction } from "../../../../components/invitation-form";
import { LocalTime } from "../../../../components/local-time";
import { OperatorFailure } from "../../../../components/operator-failure";
import { OperationForm, OperatorNav } from "../../../../components/operator-ui";
import { failure, queryValue } from "../../../../lib/http";
import { operatorRead } from "../../../../lib/operator-read";
import { sealSearch } from "../../../../lib/ops-search";
import { serverRead } from "../../../../lib/server-api";
import { isUuid } from "../../../../lib/validation";
export const metadata: Metadata = { title: "Account details" };
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params,
    query = await searchParams;
  if (!isUuid(id)) return <OperatorFailure error={failure("not_found", 404)} />;
  const result = await operatorRead<OperatorAccount | null>(
    `/api/v1/operations/accounts/${id}`,
    `/ops/accounts/${id}`,
  );
  if (!result.ok) return <OperatorFailure error={result} />;
  if (!result.data) return <OperatorFailure error={failure("not_found", 404)} />;
  const a = result.data,
    session = await serverRead<SessionView>("/api/v1/session");
  const mayManage =
    session.ok && (session.data.admin || (!a.operator && !a.admin) || session.data.userId === id);
  return (
    <section className="reader ops-page">
      <OperatorNav current="accounts" />
      <h1>{a.name || "Account details"}</h1>
      <FormNotice code={queryValue(query.notice)} />
      <dl className="account-details">
        <dt>Email</dt>
        <dd>
          {a.email} ({a.emailVerified ? "verified" : "unverified"})
        </dd>
        <dt>User ID</dt>
        <dd>{a.id}</dd>
        <dt>Hub</dt>
        <dd>{a.hub ? `@${a.hub.handle} · ${a.hub.id}` : "No hub"}</dd>
        <dt>Status</dt>
        <dd>
          {a.state === "active" ? "Active" : "Suspended"}
          {a.admin ? " · Service admin" : a.operator ? " · Service operator" : ""}
        </dd>
        <dt>Created</dt>
        <dd>
          <LocalTime at={a.createdAt} variant="date" />
        </dd>
        <dt>Active sessions</dt>
        <dd>{a.sessions}</dd>
      </dl>
      {mayManage &&
        !a.admin &&
        (a.state === "suspended" ? (
          <OperationForm
            action="account.reactivate"
            targetId={id}
            version={a.version}
            label="Reactivate account"
            consequence="Fresh sign-in will be allowed. Existing publication and sharing may become available again, except for collections still on hold. Operator access stays revoked."
          />
        ) : (
          session.ok &&
          session.data.userId !== id && (
            <OperationForm
              action="account.suspend"
              targetId={id}
              version={a.version}
              label="Suspend account"
              consequence="End all sessions and remove operator access. The account's hub and shared content become unavailable to others. Its records and settings are preserved."
            />
          )
        ))}
      {mayManage && (
        <OperationForm
          action="sessions.revoke"
          targetId={id}
          version={a.version}
          label="End all sessions"
          consequence="Sign this account out on every device. An active account can sign in again. If this is your account, you will also be signed out."
        />
      )}
      {session.ok && session.data.admin && a.operator && !a.admin && (
        <section className="operation-section">
          <h2>Remove operator access</h2>
          <p>
            The account stays active. Restoring this role requires a new invitation and acceptance.
          </p>
          <InvitationAction
            id={id}
            version={a.version}
            action="revoke"
            label="Remove operator access"
            returnTo={`/ops/accounts/${id}`}
          />
        </section>
      )}
      <p>
        <a href={`/ops/audit?${new URLSearchParams({ s: sealSearch(id) })}`}>
          View this account's operator history
        </a>
      </p>
    </section>
  );
}
