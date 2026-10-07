import { randomUUID } from "node:crypto";
import type { OperationAction, OperationReason, SessionView } from "@nslinkhub/types";
import { serverRead } from "../lib/server-api";
import { NativeForm } from "./native-form";
export async function OperatorNav() {
  const session = await serverRead<SessionView>("/api/v1/session");
  return (
    <nav aria-label="Service operations" className="context">
      <a href="/ops">Accounts and moderation</a>
      {session.ok && session.data.admin && <a href="/ops/operators">Operators and invitations</a>}
      <a href="/ops/audit">Operator audit</a>
    </nav>
  );
}
const choices: Record<OperationAction, OperationReason[]> = {
  "account.suspend": ["spam", "harmful_content", "account_compromise", "owner_request"],
  "account.reactivate": ["review_completed", "mistake_corrected", "owner_request"],
  "sessions.revoke": ["account_compromise", "owner_request", "access_administration"],
  "collection.hold": ["spam", "harmful_content", "owner_request"],
  "collection.release": ["review_completed", "mistake_corrected", "owner_request"],
};
const labels: Record<OperationReason, string> = {
  spam: "Spam",
  harmful_content: "Harmful content",
  account_compromise: "Account compromise",
  owner_request: "Owner request",
  mistake_corrected: "Mistake corrected",
  review_completed: "Review completed",
  access_administration: "Access administration",
};
export function OperationForm({
  action,
  targetId,
  version,
  label,
  consequence,
}: {
  action: OperationAction;
  targetId: string;
  version: number;
  label: string;
  consequence: string;
}) {
  return (
    <section className="operation-section">
      <h2>{label}</h2>
      <p>{consequence}</p>
      <NativeForm action="/forms/operation">
        <input type="hidden" name="action" value={action} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="operationId" value={randomUUID()} />
        <label htmlFor={`${action}-reason`}>Reason</label>
        <select id={`${action}-reason`} name="reason" required defaultValue="">
          <option value="" disabled>
            Select a reason
          </option>
          {choices[action].map((reason) => (
            <option key={reason} value={reason}>
              {labels[reason]}
            </option>
          ))}
        </select>
        <label className="confirmation">
          <input name="confirm" type="checkbox" required /> I have reviewed the target and the
          effect of this action.
        </label>
        <button
          type="submit"
          className={`button ${action.endsWith("suspend") || action.endsWith("hold") ? "danger" : ""}`}
        >
          {label}
        </button>
      </NativeForm>
    </section>
  );
}
