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
export const metadata: Metadata = { title: "Team · Service operations" };
export const dynamic = "force-dynamic";

const delivery: Record<string, string> = {
  pending: "Queued",
  sent: "Sent",
  failed: "Failed",
  suppressed: "Suppressed",
  cancelled: "Cancelled",
  expired: "Expired",
};
const state: Record<ServiceInvitationView["state"], string> = {
  pending: "Pending",
  verifying: "Verifying",
  accepted: "Accepted",
  declined: "Declined",
  cancelled: "Revoked",
  expired: "Expired",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const [team, invitations] = await Promise.all([
    operatorRead<OperatorAccount[]>(
      withCursor("/api/v1/operations/operators", queryValue(query.operators)),
      "/ops/team",
    ),
    operatorRead<ServiceInvitationView[]>(
      withCursor("/api/v1/operations/operator-invitations", queryValue(query.invitations)),
      "/ops/team",
    ),
  ]);
  if (!team.ok) return <OperatorFailure error={team} />;
  if (!invitations.ok) return <OperatorFailure error={invitations} />;
  return (
    <section className="reader ops-page">
      <OperatorNav current="team" />
      <h1>Team</h1>
      <p className="meta">
        Operators help run the service. Access starts only after they verify their email and accept.
      </p>
      <FormNotice code={queryValue(query.notice)} />
      <NativeForm action="/forms/invitation-create">
        <input type="hidden" name="operationId" value={randomUUID()} />
        <div className="ops-filters">
          <label className="ops-search">
            <span className="sr-only">Operator's email</span>
            <input
              id="invite-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="Operator's email"
            />
          </label>
          <button type="submit" className="button">
            Invite operator
          </button>
        </div>
      </NativeForm>

      <h2 className="ops-section-title">Operators</h2>
      <table className="ops-table">
        <caption className="sr-only">Service team</caption>
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col">Role</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {team.data.map((a) => (
            <tr key={a.id}>
              <td data-label="Member">
                <a href={`/ops/accounts/${a.id}`} className="ops-primary">
                  {a.name || a.email}
                </a>
                <span className="ops-secondary">{a.email}</span>
              </td>
              <td data-label="Role">{a.admin ? "Admin" : "Operator"}</td>
              <td className="ops-actions">
                {!a.admin && (
                  <InvitationAction
                    id={a.id}
                    version={a.version}
                    action="revoke"
                    label="Remove"
                    returnTo="/ops/team"
                    compact
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {team.meta?.nextCursor && (
        <a
          className="button"
          href={`/ops/team?operators=${encodeURIComponent(team.meta.nextCursor)}`}
        >
          More team members
        </a>
      )}

      <h2 className="ops-section-title">Invitations</h2>
      {invitations.data.length ? (
        <table className="ops-table">
          <caption className="sr-only">Operator invitations</caption>
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Status</th>
              <th scope="col">Delivery</th>
              <th scope="col">Expires</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invitations.data.map((i) => {
              const open =
                i.role === "operator" && ["pending", "verifying", "expired"].includes(i.state);
              return (
                <tr key={i.id}>
                  <td data-label="Email">
                    <span className="ops-primary">{i.email}</span>
                    <span className="ops-secondary">
                      {i.role === "admin" ? "Admin" : "Operator"}
                    </span>
                  </td>
                  <td data-label="Status">{state[i.state]}</td>
                  <td data-label="Delivery">{delivery[i.delivery ?? ""] ?? "—"}</td>
                  <td data-label="Expires">
                    <LocalTime at={i.expiresAt} />
                  </td>
                  <td className="ops-actions">
                    {open && (
                      <>
                        <InvitationAction
                          id={i.id}
                          version={i.version}
                          action="resend"
                          label="Resend"
                          returnTo="/ops/team"
                          compact
                        />
                        <InvitationAction
                          id={i.id}
                          version={i.version}
                          action="cancel"
                          label="Revoke"
                          returnTo="/ops/team"
                          compact
                        />
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="empty">No invitations yet.</p>
      )}
      {invitations.meta?.nextCursor && (
        <a
          className="button"
          href={`/ops/team?invitations=${encodeURIComponent(invitations.meta.nextCursor)}`}
        >
          More invitations
        </a>
      )}
    </section>
  );
}
