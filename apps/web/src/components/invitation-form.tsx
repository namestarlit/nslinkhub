import { randomUUID } from "node:crypto";
import { NativeForm } from "./native-form";
export function InvitationAction({
  id,
  version,
  action,
  label,
}: {
  id: string;
  version: number;
  action: "cancel" | "resend" | "revoke";
  label: string;
}) {
  return (
    <NativeForm action="/forms/invitation-action">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="operationId" value={randomUUID()} />
      <label className="confirmation">
        <input type="checkbox" name="confirm" required /> {`I confirm: ${label.toLowerCase()}.`}
      </label>
      <button
        className={`button ${action === "revoke" || action === "cancel" ? "danger" : ""}`}
        type="submit"
      >
        {label}
      </button>
    </NativeForm>
  );
}
