import { webServerConfig } from "@nslinkhub/config/web-server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormNotice } from "../../../components/form-notice";
import { NativeForm } from "../../../components/native-form";
import { ResendCode } from "../../../components/resend-code";
import { readFlow } from "../../../lib/form-server";
import { queryValue } from "../../../lib/http";
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
  return (
    <section className="reader account-flow">
      <h1>{flow.confirm ? "Confirm it's you" : "Check your email"}</h1>
      <p>
        Enter the code sent to <strong>{flow.email}</strong>. Codes expire after five minutes.
        {flow.confirm && " Your action continues once it's accepted."}
      </p>
      <FormNotice code={queryValue(query.notice)} wait={queryValue(query.wait)} />
      <NativeForm action="/forms/code-verify">
        <label htmlFor="code">Eight-digit code</label>
        <input
          id="code"
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9\s\-]{8,16}"
          maxLength={16}
          required
        />
        {/* Choosing to send the code was the decision; here the only way on
            is the code (or a new one if it didn't arrive). */}
        <button type="submit" className="button primary">
          {flow.confirm ? "Confirm and continue" : "Verify and continue"}
        </button>
      </NativeForm>
      <ResendCode
        remaining={Math.max(
          0,
          Math.ceil(
            ((flow.retryAt ?? flow.issued + webServerConfig().codeResendSeconds * 1000) -
              Date.now()) /
              1000,
          ),
        )}
      />
      <p>
        A new code replaces the previous one.{" "}
        {flow.invitationToken ? (
          <a href="/invitations/review">Back to invitation</a>
        ) : (
          <a href={`/sign-in?returnTo=${encodeURIComponent(flow.returnTo)}`}>
            Use a different email
          </a>
        )}
      </p>
    </section>
  );
}
