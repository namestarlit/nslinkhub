import { randomUUID } from "node:crypto";
import type { OperatorAccount, ServiceInvitationView } from "@nslinkhub/types";
import type { Metadata } from "next";
import { FormNotice } from "../../../components/form-notice";
import { InvitationAction } from "../../../components/invitation-form";
import { LocalTime } from "../../../components/local-time";
import { NativeForm } from "../../../components/native-form";
import { OperatorFailure } from "../../../components/operator-failure";
import { OperatorNav } from "../../../components/operator-ui";
import { queryValue, withCursor } from "../../../lib/http";
import { operatorRead } from "../../../lib/operator-read";
export const metadata: Metadata = { title: "Operators and invitations" };
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const [accounts, invitations] = await Promise.all([
    operatorRead<OperatorAccount[]>(
      withCursor("/api/v1/operations/operators", queryValue(query.operators)),
      "/ops/operators",
    ),
    operatorRead<ServiceInvitationView[]>(
      withCursor("/api/v1/operations/operator-invitations", queryValue(query.invitations)),
      "/ops/operators",
    ),
  ]);
  if (!accounts.ok) return <OperatorFailure error={accounts} />;
  if (!invitations.ok) return <OperatorFailure error={invitations} />;
  const delivery: Record<string, string> = {
    pending: "Email queued",
    sent: "Email sent",
    failed: "Email failed",
    suppressed: "Email suppressed",
    cancelled: "Email cancelled",
    expired: "Email expired",
  };
  return (
    <section className="reader">
      <OperatorNav />
      <h1>Operators and invitations</h1>
      <p>
        Invite someone to help operate the service. They receive access only after verifying their
        email and accepting.
      </p>
      <FormNotice code={queryValue(query.notice)} />
      <NativeForm action="/forms/invitation-create">
        <input type="hidden" name="operationId" value={randomUUID()} />
        <label htmlFor="invite-email">Operator's email</label>
        <input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
        <button type="submit" className="button">
          Send operator invitation
        </button>
      </NativeForm>
      <h2 className="list-heading">Service team</h2>
      <ul className="collection-list">
        {accounts.data.map((a) => (
          <li className="collection-row" key={a.id}>
            <h2>
              <a href={`/ops/accounts/${a.id}`}>{a.name || a.email}</a>
            </h2>
            <p>
              {a.email} · {a.admin ? "Admin" : "Operator"}
            </p>
          </li>
        ))}
      </ul>
      {accounts.meta?.nextCursor && (
        <a
          className="button"
          href={`/ops/operators?operators=${encodeURIComponent(accounts.meta.nextCursor)}`}
        >
          More team members
        </a>
      )}
      <h2 className="list-heading">Invitations</h2>
      {!invitations.data.length && (
        <p className="empty">No invitations yet. Send one using the email field above.</p>
      )}
      <ul className="collection-list">
        {invitations.data.map((i) => (
          <li className="collection-row" key={i.id}>
            <h3>{i.email}</h3>
            <p>
              {i.role === "admin" ? "Admin" : "Operator"} · {i.state} ·{" "}
              {delivery[i.delivery ?? ""] ?? "Email record unavailable"}
            </p>
            <p className="meta">
              Expires <LocalTime at={i.expiresAt} />
            </p>
            {i.role === "operator" && ["pending", "verifying", "expired"].includes(i.state) && (
              <>
                <InvitationAction
                  id={i.id}
                  version={i.version}
                  action="resend"
                  label="Resend invitation"
                />
                <InvitationAction
                  id={i.id}
                  version={i.version}
                  action="cancel"
                  label="Cancel invitation"
                />
              </>
            )}
          </li>
        ))}
      </ul>
      {invitations.meta?.nextCursor && (
        <a
          className="button"
          href={`/ops/operators?invitations=${encodeURIComponent(invitations.meta.nextCursor)}`}
        >
          More invitations
        </a>
      )}
    </section>
  );
}
