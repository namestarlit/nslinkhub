import { webServerConfig } from "@nslinkhub/config/web-server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyCode } from "../../../components/verification";
import { readFlow } from "../../../lib/form-server";
import { queryValue } from "../../../lib/http";
import { readPendingAction } from "../../../lib/pending-action";
import { verificationCopy } from "../../../lib/verification";
export const metadata: Metadata = { title: "Verify your email" };
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const flow = await readFlow();
  if (!flow) redirect("/sign-in?notice=expired");
  const query = await searchParams;
  const purpose = flow.purpose ?? (flow.invitationToken ? "invitation" : "sign-in");
  const pending = purpose === "confirm" || purpose === "resume" ? await readPendingAction() : null;
  return (
    <VerifyCode
      copy={verificationCopy(purpose, { returnTo: flow.returnTo, action: pending?.label })}
      email={flow.email}
      notice={queryValue(query.notice)}
      wait={queryValue(query.wait)}
      resendIn={Math.max(
        0,
        Math.ceil(
          ((flow.retryAt ?? flow.issued + webServerConfig().codeResendSeconds * 1000) -
            Date.now()) /
            1000,
        ),
      )}
      footer={
        purpose === "invitation" ? (
          <a href="/invitations/review">Back to invitation</a>
        ) : purpose === "confirm" ? null : (
          <a href={`/sign-in?returnTo=${encodeURIComponent(flow.returnTo)}`}>
            Use a different email
          </a>
        )
      }
    />
  );
}
