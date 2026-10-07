import type { ServiceInvitationView } from "@nslinkhub/types";
import type { Metadata } from "next";
import { FormNotice } from "../../../components/form-notice";
import { LocalTime } from "../../../components/local-time";
import { queryValue } from "../../../lib/http";
import { operatorRead } from "../../../lib/operator-read";
import { isUuid } from "../../../lib/validation";
export const metadata: Metadata = { title: "Service invitation" };
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
  const result = isUuid(id)
    ? await operatorRead<ServiceInvitationView>(`/api/v1/invitations/${id}`, `/invitations/${id}`)
    : null;
  if (!result?.ok)
    return (
      <section className="reader feedback">
        <h1>Invitation unavailable</h1>
        <p>
          {!result || [403, 404].includes(result.status)
            ? "Sign in with the email that received it. If it's no longer available, ask the admin for a new one."
            : "We couldn't load this invitation. Try again shortly."}
        </p>
        <a href={`/sign-in?returnTo=${encodeURIComponent(`/invitations/${id}`)}`}>
          Sign in with the invited email
        </a>
      </section>
    );
  const invite = result.data;
  return (
    <section className="reader">
      <a href="/notifications">Notifications</a>
      <h1>
        {["pending", "verifying"].includes(invite.state)
          ? "Check your inbox"
          : "Service invitation"}
      </h1>
      <p>Invitation for {invite.email}</p>
      <FormNotice code={queryValue(query.notice)} />
      {["pending", "verifying"].includes(invite.state) ? (
        <>
          <p>
            {invite.role === "admin"
              ? "You will manage accounts, invite and remove operators, and moderate public content."
              : "You will help manage accounts and moderate public content. The admin manages operator access."}{" "}
            Actions are recorded in the service audit. This role does not give access to private
            collections.
          </p>
          <p className="meta">
            Accept by <LocalTime at={invite.expiresAt} />.
          </p>
          <p>
            Use the Review invitation button in your invitation email to review, accept or decline.
            If you don't see the email, check your spam folder.
          </p>
        </>
      ) : (
        <>
          <p>
            This invitation is {invite.state}.
            {invite.state === "expired"
              ? invite.role === "admin"
                ? " Ask the person who set up the service for a new invitation."
                : " Ask the admin for a new invitation."
              : ""}
          </p>
          <a href={invite.state === "accepted" ? "/ops" : "/discover"}>
            {invite.state === "accepted" ? "Open service operations" : "Discover collections"}
          </a>
        </>
      )}
    </section>
  );
}
