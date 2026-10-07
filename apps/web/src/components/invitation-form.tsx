import { randomUUID } from "node:crypto";
import { NativeForm } from "./native-form";

// Team actions: resend an invitation, revoke an invitation ("cancel" in the
// API) or remove an operator ("revoke"). One clearly labelled button; the page
// returns to where the action was taken.
export function InvitationAction({
  id,
  version,
  action,
  label,
  returnTo,
  compact = false,
}: {
  id: string;
  version: number;
  action: "cancel" | "resend" | "revoke";
  label: string;
  returnTo: string;
  compact?: boolean;
}) {
  const removes = action !== "resend";
  return (
    <NativeForm action="/forms/invitation-action">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="operationId" value={randomUUID()} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        className={
          compact ? `text-button${removes ? " danger" : ""}` : `button${removes ? " danger" : ""}`
        }
        type="submit"
      >
        {label}
      </button>
    </NativeForm>
  );
}
