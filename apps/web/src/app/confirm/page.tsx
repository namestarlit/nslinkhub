import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readPendingAction } from "../../lib/pending-action";
import { readSession } from "../../lib/session";
export const metadata: Metadata = { title: "Confirm it's you" };
export const dynamic = "force-dynamic";

// Step-up for sensitive actions: the person is already signed in, so we know
// where to send the code. After the code, the waiting action runs by itself.
export default async function Page() {
  const [session, pending] = await Promise.all([readSession(), readPendingAction()]);
  if (!session) redirect("/sign-in?notice=signin");
  if (!pending) redirect("/ops");
  return (
    <section className="reader account-flow">
      <h1>Confirm it's you</h1>
      <p>
        To {pending.label}, we'll send a code to <strong>{session.email}</strong>. Enter it on the
        next screen and the action continues.
      </p>
      <form method="post" className="action-form">
        <div className="invitation-actions">
          <button type="submit" formAction="/forms/confirm-send" className="button primary">
            Send code
          </button>
          <button
            type="submit"
            formAction="/forms/confirm-cancel"
            className="button"
            formNoValidate
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
