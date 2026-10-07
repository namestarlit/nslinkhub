import type { Metadata } from "next";
import { FormNotice } from "../../components/form-notice";
import { NativeForm } from "../../components/native-form";
import { readDraft } from "../../lib/capture-server";
import { queryValue, safeReturn } from "../../lib/http";
export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const returnTo = safeReturn(queryValue(query.returnTo) ?? "/hub");
  const draftId = /^\/capture\/([a-f0-9-]{36})$/.exec(returnTo)?.[1];
  const draft = draftId ? await readDraft(draftId) : null;
  return (
    <section className="reader account-flow">
      <h1>{draft ? "Verify your email to save this link" : "Sign in"}</h1>
      <p>
        Enter your email. We'll send an eight-digit code to sign in or create your personal hub.
      </p>
      <FormNotice code={queryValue(query.notice)} />
      <NativeForm action="/forms/code-send">
        <input type="hidden" name="returnTo" value={returnTo} />
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
        <button className="button primary" type="submit">
          Send code
        </button>
      </NativeForm>
      <p>
        <a href={draft ? `/capture/${draft.id}` : "/discover"}>
          {draft ? "Back to your link" : "Back to Discover"}
        </a>
      </p>
      {query.notice === "signout-failed" && (
        <NativeForm action="/forms/sign-out">
          <button type="submit" className="button">
            Try signing out again
          </button>
        </NativeForm>
      )}
    </section>
  );
}
