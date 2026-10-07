import type { Failure } from "../lib/http";
import { safeReturn } from "../lib/http";
import { readSession } from "../lib/session";
import { Feedback } from "./feedback";

export async function CollectionFeedback({
  error,
  returnTo,
}: {
  error: Failure;
  returnTo: string;
}) {
  const unavailable =
    error.code !== "invalid_cursor" && [400, 401, 403, 404].includes(error.status);
  const signedOut = unavailable && !(await readSession());
  return (
    <Feedback
      collection
      error={error}
      resetPath={returnTo}
      signInHref={
        signedOut
          ? `/sign-in?${new URLSearchParams({ returnTo: safeReturn(returnTo) })}`
          : undefined
      }
    />
  );
}
