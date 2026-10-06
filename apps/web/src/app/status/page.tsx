import type { Readiness } from "@nslinkhub/types";
import type { Metadata } from "next";
import { StatusCheck } from "../../components/status-check";
import { serverRead } from "../../lib/server-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Service status · nslinkhub" };

export default async function Page() {
  const result = await serverRead<Readiness>("/api/v1/status");
  const state = result.ok
    ? result.data?.status
    : result.status === 503 && result.code === "dependencies_unavailable"
      ? "unavailable"
      : undefined;
  const known = state === "ready" || state === "degraded" || state === "unavailable";
  const title =
    state === "ready"
      ? "All systems ready"
      : state === "degraded"
        ? "Some services are limited"
        : state === "unavailable"
          ? "Temporarily unavailable"
          : "We couldn't check the service";
  const description =
    state === "ready"
      ? "Collections are available to browse."
      : state === "degraded"
        ? "You can still browse collections. Some other services may be delayed."
        : state === "unavailable"
          ? "The service is temporarily unavailable. Please try again shortly."
          : !result.ok && result.status === 429
            ? "There have been too many requests. Please wait before checking again."
            : "The latest status couldn't be confirmed. Please try again.";
  return (
    <section className="reader service-status" data-reader>
      <p className="status-label">Service status</p>
      <div className="status-heading">
        <span className="status-marker" data-state={known ? state : "unknown"} aria-hidden="true" />
        <h1>{title}</h1>
      </div>
      <p className="status-description">{description}</p>
      <div className="status-actions">
        <StatusCheck retry={state !== "ready"} seconds={result.ok ? 0 : result.retryAfter} />
        <a className="button" href="/">
          Explore collections
        </a>
      </div>
    </section>
  );
}
