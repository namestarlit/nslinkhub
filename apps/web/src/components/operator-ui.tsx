import { randomUUID } from "node:crypto";
import type { OperationAction, OperationReason, SessionView } from "@nslinkhub/types";
import { serverRead } from "../lib/server-api";
import { NativeForm } from "./native-form";

export type OpsTab = "accounts" | "collections" | "team" | "audit";

// One tab per operations area, so one long list never pushes another task down
// the page. The current tab is marked for assistive technology and visually.
export async function OperatorNav({ current }: { current?: OpsTab }) {
  const session = await serverRead<SessionView>("/api/v1/session");
  const tabs: [OpsTab, string, string][] = [
    ["accounts", "/ops", "Accounts"],
    ["collections", "/ops/collections", "Collections"],
    ...(session.ok && session.data.admin
      ? [["team", "/ops/team", "Team"] as [OpsTab, string, string]]
      : []),
    ["audit", "/ops/audit", "Audit"],
  ];
  return (
    <nav aria-label="Service operations" className="ops-tabs">
      {tabs.map(([key, href, label]) => (
        <a key={key} href={href} aria-current={key === current ? "page" : undefined}>
          {label}
        </a>
      ))}
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
const restrictive = (action: OperationAction) =>
  action.endsWith("suspend") || action.endsWith("hold");

// The fields every operation submits. The required reason plus a clearly
// labelled button is the deliberate step; there is no extra confirmation box.
function OperationFields({
  action,
  targetId,
  version,
  label,
  returnTo,
  idSuffix = "",
}: {
  action: OperationAction;
  targetId: string;
  version: number;
  label: string;
  returnTo?: string;
  idSuffix?: string;
}) {
  const field = `${action}-reason${idSuffix}`;
  return (
    <>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="operationId" value={randomUUID()} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <label htmlFor={field}>Reason</label>
      <select id={field} name="reason" required defaultValue="">
        <option value="" disabled>
          Select a reason
        </option>
        {choices[action].map((reason) => (
          <option key={reason} value={reason}>
            {labels[reason]}
          </option>
        ))}
      </select>
      <button type="submit" className={`button ${restrictive(action) ? "danger" : ""}`}>
        {label}
      </button>
    </>
  );
}

// A full section on an account or collection page.
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
        <OperationFields action={action} targetId={targetId} version={version} label={label} />
      </NativeForm>
    </section>
  );
}

// A table-row action: the short label opens an inline reason and confirm
// button, then the page reloads with the row's new state.
export function QuickAction({
  action,
  targetId,
  version,
  label,
  returnTo,
}: {
  action: OperationAction;
  targetId: string;
  version: number;
  label: string;
  returnTo: string;
}) {
  return (
    <details className="quick-action">
      <summary className={`text-button${restrictive(action) ? " danger" : ""}`}>{label}</summary>
      <NativeForm action="/forms/operation">
        <OperationFields
          action={action}
          targetId={targetId}
          version={version}
          label={label}
          returnTo={returnTo}
          idSuffix={`-${targetId}`}
        />
      </NativeForm>
    </details>
  );
}
