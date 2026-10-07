import { randomUUID } from "node:crypto";
import { webServerConfig } from "@nslinkhub/config/web-server";
import type {
  CaptureLink,
  InvitationAcceptance,
  OperationCommand,
  OperatorAccount,
  Profile,
} from "@nslinkhub/types";
import {
  isPublicLinkHost,
  maxCaptureLinks,
  operationActions,
  operationReasons,
} from "@nslinkhub/types";
import type { CaptureDraft } from "../../../lib/capture-draft";
import { draftCookie, draftRoom, readDraft, saveDraft } from "../../../lib/capture-server";
import {
  flowCookie,
  formData,
  formPost,
  invitationCookie,
  readFlow,
  readInvitationFlow,
  redirectResponse,
  sealFlow,
  sealInvitationFlow,
} from "../../../lib/form-server";
import { type ApiPath, safeDocumentReturn, safeReturn, sessionCookie } from "../../../lib/http";
import { readSession } from "../../../lib/session";
import { resendTiming } from "../../../lib/sign-in-flow";
import { appearanceCookie } from "../../../lib/theme";
import { captureUrl, isUuid, parseTags } from "../../../lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  let form: URLSearchParams;
  try {
    form = await formData(request);
  } catch {
    return new Response("Unable to submit this form. Return to the page and try again.", {
      status: 403,
    });
  }
  if (action === "capture-save") {
    const id = form.get("draftId") ?? "";
    if (!isUuid(id)) return redirectResponse("/capture?notice=invalid");
    const previous = await readDraft(id);
    const back = (notice: string) =>
      redirectResponse(`${previous ? `/capture/${id}` : "/capture"}?notice=${notice}`);
    // One row per link: URL and optional comma-separated tags (titles are
    // resolved from the page, never typed). Rows left empty are ignored; any
    // other unusable address rejects the save.
    const tags = form.getAll("tags");
    const links: CaptureLink[] = [];
    for (const [index, raw] of form.getAll("url").entries()) {
      if (!raw.trim()) continue;
      const url = captureUrl(raw.trim());
      if (!url) return back("link-invalid");
      if (!isPublicLinkHost(new URL(url).hostname)) return back("link-not-public");
      const tagList = parseTags(tags[index]);
      links.push({ url, ...(tagList.length ? { tags: tagList } : {}) });
    }
    const destination = form.get("destination") ?? "";
    if (!links.length || (!["first", "new"].includes(destination) && !isUuid(destination)))
      return back("link-invalid");
    if (links.length > maxCaptureLinks) return back("too-many-links");
    const collectionTitle =
      destination === "new"
        ? form.get("collectionTitle")?.trim().slice(0, 255) || undefined
        : undefined;
    const same =
      previous &&
      JSON.stringify([previous.links, previous.destination, previous.collectionTitle]) ===
        JSON.stringify([links, destination, collectionTitle]);
    const draft: CaptureDraft = {
      id,
      links,
      destination,
      ...(collectionTitle ? { collectionTitle } : {}),
      issued: previous?.issued ?? Date.now(),
      operationId: same ? previous.operationId : previous ? randomUUID() : id,
    };
    try {
      draftCookie(draft);
    } catch {
      return back("too-many-links");
    }
    const room = previous ? [] : await draftRoom();
    // No session cookie: sign in first. An expired session is caught by the
    // save's 401, which keeps the draft the same way.
    if (!sessionCookie(request.headers.get("cookie") ?? ""))
      return redirectResponse(`/sign-in?returnTo=${encodeURIComponent(`/capture/${id}`)}`, [
        ...room,
        draftCookie(draft),
      ]);
    return saveDraft(request, draft, room);
  }
  if (action.startsWith("comment-")) {
    // Every comment write returns to the collection it belongs to (permalink or
    // pretty URL, keeping an explicit share token) at the discussion.
    const returnTo = safeReturn(form.get("returnTo"));
    const token = new URL(returnTo, "http://local.invalid").searchParams.get("s");
    const scoped = token ? `?s=${encodeURIComponent(token)}` : "";
    const back = (notice: string, anchor = "comments") =>
      redirectResponse(
        `${returnTo}${returnTo.includes("?") ? "&" : "?"}notice=${notice}#${anchor}`,
      );
    const id = form.get("id") ?? "";
    if (!isUuid(id)) return back("comment-unavailable");
    const body = (form.get("body") ?? "").trim().slice(0, 2000);
    const parentId = form.get("parentId") ?? "";
    const verbs: Record<string, [string, "POST" | "PATCH" | "DELETE", unknown, string]> = {
      "comment-post": [
        `/api/v1/collections/${id}/comments${scoped}`,
        "POST",
        { body, ...(isUuid(parentId) ? { parentId } : {}) },
        "comment-posted",
      ],
      "comment-edit": [
        `/api/v1/comments/${id}`,
        "PATCH",
        { body, version: Number(form.get("version")) },
        "comment-saved",
      ],
      "comment-delete": [`/api/v1/comments/${id}`, "DELETE", {}, "comment-deleted"],
      "comment-hide": [`/api/v1/comments/${id}/hide`, "POST", {}, "done"],
      "comment-show": [`/api/v1/comments/${id}/show`, "POST", {}, "done"],
      "comment-accept": [`/api/v1/comments/${id}/accept`, "POST", {}, "comment-answer"],
      "comment-unaccept": [`/api/v1/comments/${id}/unaccept`, "POST", {}, "done"],
    };
    const verb = verbs[action];
    if (!verb) return back("comment-unavailable");
    if (["comment-post", "comment-edit"].includes(action) && !body) return back("comment-empty");
    const [path, method, payload, success] = verb;
    const result = await formPost<{ id?: string }>(
      request,
      path as ApiPath,
      payload,
      false,
      method,
    );
    if (result.ok)
      return back(
        success,
        result.data?.id && action !== "comment-delete" ? `comment-${result.data.id}` : "comments",
      );
    if (result.status === 401)
      return redirectResponse(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    return back(
      result.code === "comments_disabled"
        ? "comments-off"
        : result.status === 409
          ? "conflict"
          : result.status === 429
            ? "limited"
            : result.status === 400
              ? "comment-empty"
              : "comment-unavailable",
    );
  }
  if (action === "notifications-seen" || action === "notifications-clear") {
    const seen = action === "notifications-seen";
    const result = await formPost(request, `/api/v1/notifications/${seen ? "seen" : "clear"}`, {});
    // "Seen" is a background request from the open Notifications page.
    if (seen) return new Response(null, { status: result.ok ? 204 : result.status || 503 });
    return redirectResponse(
      result.ok
        ? "/notifications?notice=cleared"
        : result.status === 401
          ? "/sign-in?returnTo=%2Fnotifications"
          : "/notifications?notice=unavailable",
    );
  }
  if (action === "theme") {
    const theme = form.get("theme");
    if (!["light", "dark", "system"].includes(theme ?? ""))
      return new Response("Invalid appearance", { status: 400 });
    if (!(await readSession())) return redirectResponse("/sign-in?returnTo=%2Fsettings");
    return redirectResponse(safeDocumentReturn(form.get("returnTo")), [
      appearanceCookie(theme as string),
    ]);
  }
  if (action === "profile-save") {
    const json = request.headers.get("accept")?.includes("application/json");
    const displayName = form.get("displayName")?.trim() ?? "",
      hubName = form.get("hubName")?.trim(),
      handle = form.get("handle")?.trim().toLowerCase(),
      hubDescription = form.get("hubDescription") ?? "",
      showNameOnHub = form.get("showNameOnHub") === "on";
    if (
      !hubName ||
      hubName.length > 255 ||
      displayName.length > 255 ||
      !handle ||
      !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle) ||
      handle.length < 3 ||
      handle.length > 60 ||
      hubDescription.length > 5000
    )
      return json
        ? Response.json({ ok: false, code: "validation_failed", status: 400 }, { status: 400 })
        : redirectResponse("/settings?notice=profile-invalid");
    const result = await formPost<Profile>(
      request,
      "/api/v1/profile",
      { displayName, hubName, handle, hubDescription, showNameOnHub },
      false,
      "PATCH",
    );
    if (json)
      return Response.json(result, {
        status: result.ok ? 200 : result.status || 503,
        headers: { "Cache-Control": "private, no-store" },
      });
    if (!result.ok && result.status === 401)
      return redirectResponse("/sign-in?returnTo=%2Fsettings&notice=signin");
    return redirectResponse(
      `/settings?notice=${result.ok ? "profile-saved" : result.code === "handle_unavailable" ? "handle-unavailable" : result.code === "handle_reserved" || result.code === "handle_invalid" ? "handle-invalid" : result.status === 429 ? "limited" : "unavailable"}`,
    );
  }
  if (action === "invitation-open") {
    let token = form.get("token")?.trim() ?? "";
    if (token.includes("#token=")) {
      try {
        token = new URL(token).hash.slice(7);
      } catch {
        token = "";
      }
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      return redirectResponse("/invitations/accept?notice=invalid");
    return redirectResponse("/invitations/review", [
      invitationCookie(sealInvitationFlow({ token, issued: Date.now() })),
    ]);
  }
  if (action === "invitation-sign-out") {
    const result = await formPost(request, "/api/v1/auth/sign-out", {}, true);
    return redirectResponse(
      `/invitations/review${result.ok ? "" : "?notice=signout-failed"}`,
      result.ok ? result.setCookies : [],
    );
  }
  if (action === "invitation-resume") {
    const flow = await readInvitationFlow();
    if (!flow) return redirectResponse("/invitations/accept");
    const result = await formPost<InvitationAcceptance>(
      request,
      "/api/v1/auth/invitations/resend",
      { token: flow.token },
      true,
    );
    if (!result.ok)
      return redirectResponse(
        `/invitations/review?notice=${result.status === 429 ? "limited" : "unavailable"}`,
      );
    return redirectResponse("/sign-in/code?notice=sent", [
      flowCookie(
        sealFlow({
          email: result.data.email,
          returnTo: "/ops",
          invitationToken: flow.token,
          issued: Date.now(),
        }),
      ),
    ]);
  }
  if (action === "invitation-respond") {
    const flow = await readInvitationFlow();
    if (!flow) return redirectResponse("/invitations/accept?notice=expired");
    if (!["accept", "decline"].includes(form.get("action") ?? ""))
      return redirectResponse("/invitations/review?notice=invalid");
    const result = await formPost<InvitationAcceptance>(
      request,
      "/api/v1/auth/invitations/accept",
      {
        token: flow.token,
        action: form.get("action"),
        operationId: form.get("operationId"),
        version: Number(form.get("version")),
        ...(form.has("name") ? { name: form.get("name") } : {}),
      },
      true,
    );
    if (!result.ok)
      return redirectResponse(
        `/invitations/review?notice=${result.code === "invitation_session_mismatch" ? "wrong-account" : result.status === 400 ? "invalid" : result.status === 409 ? "conflict" : result.status === 429 ? "limited" : "unavailable"}`,
      );
    if (result.data.state === "declined")
      return redirectResponse("/invitations/review?notice=declined");
    return redirectResponse("/sign-in/code?notice=invitation-accepted", [
      flowCookie(
        sealFlow({
          email: result.data.email,
          returnTo: "/ops",
          invitationToken: flow.token,
          issued: Date.now(),
        }),
      ),
    ]);
  }
  if (action === "code-send" || action === "code-resend") {
    const previous = action === "code-resend" ? await readFlow() : null;
    const email = previous?.email ?? form.get("email")?.trim().toLowerCase();
    const returnTo = previous?.returnTo ?? safeReturn(form.get("returnTo"));
    if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email))
      return redirectResponse("/sign-in?notice=invalid");
    const result = await formPost(
      request,
      previous?.invitationToken ? "/api/v1/auth/invitations/resend" : "/api/v1/auth/code/send",
      previous?.invitationToken ? { token: previous.invitationToken } : { email },
      true,
    );
    // Cooldowns do not change the flow's actual issuance or extend its lifetime.
    const flow = {
      email,
      returnTo,
      ...resendTiming(previous, result, webServerConfig().codeResendSeconds),
      ...(previous?.invitationToken ? { invitationToken: previous.invitationToken } : {}),
    };
    return redirectResponse(
      `/sign-in/code?notice=${result.ok ? "sent" : result.status === 429 ? "limited" : "unavailable"}${!result.ok && result.retryAfter ? `&wait=${Math.min(result.retryAfter, 600)}` : ""}`,
      [flowCookie(sealFlow(flow), returnTo.startsWith("/capture/") ? 1800 : 600)],
    );
  }
  if (action === "code-verify") {
    const flow = await readFlow();
    if (!flow) return redirectResponse("/sign-in?notice=expired");
    const code = form.get("code");
    if (!code || !/^\d{8}$/.test(code)) return redirectResponse("/sign-in/code?notice=invalid");
    const result = await formPost(
      request,
      flow.invitationToken ? "/api/v1/auth/invitations/verify" : "/api/v1/auth/code/verify",
      flow.invitationToken ? { token: flow.invitationToken, code } : { email: flow.email, code },
      true,
    );
    if (!result.ok)
      return redirectResponse(
        `/sign-in/code?notice=${result.status === 429 ? "limited" : result.status >= 500 || !result.status ? "unavailable" : "invalid"}${result.retryAfter ? `&wait=${Math.min(result.retryAfter, 600)}` : ""}`,
      );
    const captureId = /^\/capture\/([a-f0-9-]{36})$/.exec(flow.returnTo)?.[1];
    if (!flow.invitationToken && captureId) {
      const draft = await readDraft(captureId);
      if (draft) {
        const headers = new Headers(request.headers);
        headers.set(
          "cookie",
          (result.setCookies ?? []).map((cookie) => cookie.split(";")[0]).join("; "),
        );
        return saveDraft(new Request(request.url, { headers }), draft, [
          ...(result.setCookies ?? []),
          flowCookie("", 0),
        ]);
      }
    }
    return redirectResponse(flow.returnTo, [
      ...(result.setCookies ?? []),
      flowCookie("", 0),
      ...(flow.invitationToken ? [invitationCookie("", 0)] : []),
    ]);
  }
  if (action === "sign-out") {
    const result = await formPost(request, "/api/v1/auth/sign-out", {}, true);
    return result.ok
      ? redirectResponse("/?notice=signed-out", result.setCookies)
      : redirectResponse("/sign-in?notice=signout-failed");
  }
  if (action === "account-lookup") {
    const lookup = form.get("lookup");
    if (!lookup || lookup.length > 254) return redirectResponse("/ops?notice=invalid");
    const result = await formPost<OperatorAccount[]>(
      request,
      "/api/v1/operations/accounts/lookup",
      { lookup },
    );
    if (!result.ok)
      return redirectResponse(`/ops?notice=${result.status === 401 ? "signin" : "unavailable"}`);
    return redirectResponse(
      result.data[0] ? `/ops/accounts/${result.data[0].id}` : "/ops?notice=no-match",
    );
  }
  if (action === "collection-lookup") {
    const id = form.get("collectionId");
    if (!id || !isUuid(id)) return redirectResponse("/ops?notice=invalid");
    return redirectResponse(`/ops/collections/${encodeURIComponent(id)}`);
  }
  if (action === "invitation-create" || action === "invitation-action") {
    const id = form.get("id"),
      verb = form.get("action"),
      operationId = form.get("operationId");
    if (
      !isUuid(operationId ?? "") ||
      (action === "invitation-action" &&
        (!isUuid(id ?? "") ||
          !["resend", "cancel", "revoke"].includes(verb ?? "") ||
          !form.has("confirm")))
    )
      return redirectResponse("/ops/operators?notice=invalid");
    const target = verb === "revoke" ? `/ops/accounts/${id}` : "/ops/operators";
    const path =
      action === "invitation-create"
        ? "/api/v1/operations/operator-invitations"
        : verb === "revoke"
          ? (`/api/v1/operations/operators/${id}/revoke` as const)
          : (`/api/v1/operations/operator-invitations/${id}` as const);
    const body =
      action === "invitation-create"
        ? { email: form.get("email"), operationId }
        : {
            operationId,
            version: Number(form.get("version")),
            ...(verb === "revoke" ? {} : { action: verb }),
          };
    const result = await formPost(request, path, body);
    if (!result.ok && (result.status === 401 || result.code === "recent_auth_required"))
      return redirectResponse(`/sign-in?returnTo=${encodeURIComponent(target)}&notice=reauth`);
    return redirectResponse(
      `${target}?notice=${result.ok ? "done" : result.status === 409 ? "conflict" : result.status === 403 ? "forbidden" : result.status === 400 ? "invalid" : result.status === 429 ? "limited" : "unavailable"}`,
    );
  }
  if (action === "operation") {
    const command = {
      action: form.get("action"),
      targetId: form.get("targetId"),
      reason: form.get("reason"),
      version: Number(form.get("version")),
      operationId: form.get("operationId"),
    };
    if (
      !operationActions.includes(command.action as OperationCommand["action"]) ||
      !operationReasons.includes(command.reason as OperationCommand["reason"]) ||
      !isUuid(command.targetId ?? "") ||
      !isUuid(command.operationId ?? "") ||
      !form.has("confirm")
    )
      return redirectResponse("/ops?notice=invalid");
    const target = `/ops/${command.action?.startsWith("collection.") ? "collections" : "accounts"}/${command.targetId}`;
    const result = await formPost(request, "/api/v1/operations/commands", command);
    if (!result.ok && (result.status === 401 || result.code === "recent_auth_required"))
      return redirectResponse(`/sign-in?returnTo=${encodeURIComponent(target)}&notice=reauth`);
    return redirectResponse(
      `${target}?notice=${result.ok ? "done" : result.status === 409 ? "conflict" : result.status === 403 ? "forbidden" : result.status === 429 ? "limited" : "unavailable"}`,
    );
  }
  return new Response("Not found", { status: 404 });
}
