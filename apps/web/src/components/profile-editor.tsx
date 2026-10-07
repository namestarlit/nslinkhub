"use client";
import type { HandleAvailability, Profile } from "@nslinkhub/types";
import { useEffect, useRef, useState } from "react";
import { readJson, submitForm } from "../lib/http";
import { CopyHubLink } from "./copy-link";
import { FormNotice } from "./form-notice";
import { LocalTime } from "./local-time";

type Draft = {
  showNameOnHub: boolean;
  displayName: string;
  hubName: string;
  handle: string;
  hubDescription: string;
};
type HandleState = HandleAvailability["status"] | "checking" | "error";
const handleMessages: Record<HandleState, string> = {
  current: "",
  available: "Available",
  invalid: "Use 3–60 lowercase letters, numbers and single hyphens between words.",
  reserved: "This handle is reserved. Choose another.",
  taken: "This handle is already in use. Choose another.",
  checking: "Checking availability…",
  error: "We couldn't check availability. You can still try saving your profile.",
};
function draftOf(profile: Profile): Draft {
  return {
    displayName: profile.displayName,
    showNameOnHub: profile.showNameOnHub,
    hubName: profile.hubName ?? "",
    handle: profile.handle ?? "",
    hubDescription: profile.hubDescription ?? "",
  };
}
function sameDraft(a: Draft, b: Draft) {
  return (
    a.displayName === b.displayName &&
    a.showNameOnHub === b.showNameOnHub &&
    a.hubName === b.hubName &&
    a.handle === b.handle &&
    a.hubDescription === b.hubDescription
  );
}
function readDraft(form: HTMLFormElement): Draft {
  const data = new FormData(form);
  return {
    displayName: String(data.get("displayName") ?? ""),
    showNameOnHub: data.get("showNameOnHub") === "on",
    hubName: String(data.get("hubName") ?? ""),
    handle: String(data.get("handle") ?? ""),
    hubDescription: String(data.get("hubDescription") ?? ""),
  };
}

export function ProfileEditor({ profile, notice }: { profile: Profile; notice?: string }) {
  const [saved, setSaved] = useState(profile);
  const [draft, setDraft] = useState(() => draftOf(profile));
  const form = useRef<HTMLFormElement>(null);
  const latest = useRef(draft);
  const [enhanced, setEnhanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const navigateAfterSave = useRef<string | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    success: boolean;
    signIn?: boolean;
  }>();
  const [check, setCheck] = useState<{ handle: string; status: HandleState }>({
    handle: profile.handle ?? "",
    status: "current",
  });
  const handle = draft.handle.trim().toLowerCase();
  const validFormat =
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.handle) && handle.length >= 3 && handle.length <= 60;
  const handleState: HandleState = !validFormat
    ? "invalid"
    : handle === saved.handle
      ? "current"
      : check.handle === handle
        ? check.status
        : "checking";
  const dirty = !sameDraft(draft, draftOf(saved));
  const savedFeedback =
    !saving && !dirty && (feedback ? feedback.success : notice === "profile-saved");

  useEffect(() => {
    // Preserve typing/autofill that happened before hydration. Native controls
    // own their values; React owns validation and confirmed-save feedback.
    if (form.current) {
      latest.current = readDraft(form.current);
      setDraft(latest.current);
    }
    setEnhanced(true);
  }, []);
  useEffect(() => {
    if (!validFormat || handle === saved.handle) return;
    const controller = new AbortController();
    setCheck({ handle, status: "checking" });
    const timer = setTimeout(async () => {
      const result = await readJson<HandleAvailability>(
        `/api/v1/profile/handle-availability?handle=${encodeURIComponent(handle)}`,
        { timeout: 5000, signal: controller.signal },
      );
      if (!controller.signal.aborted)
        setCheck({ handle, status: result.ok ? result.data.status : "error" });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [handle, validFormat, saved.handle]);

  const edit = () => {
    if (!form.current) return;
    const next = readDraft(form.current);
    latest.current = next;
    setDraft(next);
    setFeedback(undefined);
  };

  // Native fields retain typing during requests; only confirmed server values
  // replace an unchanged draft. Newer edits schedule their own subsequent save.
  async function save() {
    if (busy.current || !form.current) return;
    busy.current = true;
    setSaving(true);
    setFeedback(undefined);
    const submitted = readDraft(form.current);
    latest.current = submitted;
    setDraft(submitted);
    try {
      const result = await submitForm<Profile>(
        "/forms/profile-save",
        new URLSearchParams({ ...submitted, showNameOnHub: submitted.showNameOnHub ? "on" : "" }),
      );
      if (result.ok) {
        setSaved(result.data);
        const unchanged = sameDraft(latest.current, submitted);
        if (unchanged) {
          const next = draftOf(result.data);
          latest.current = next;
          setDraft(next);
          for (const [key, value] of Object.entries(next)) {
            const field = form.current?.elements.namedItem(key);
            if (field instanceof HTMLInputElement && typeof value === "boolean")
              field.checked = value;
            else if (
              (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) &&
              typeof value === "string"
            )
              field.value = value;
          }
        }
        setFeedback({
          success: true,
          message: unchanged
            ? "Your profile has been saved."
            : "Your earlier changes were saved. You still have unsaved changes.",
        });
        if (unchanged && navigateAfterSave.current) {
          window.location.assign(navigateAfterSave.current);
          navigateAfterSave.current = null;
        }
        window.dispatchEvent(
          new CustomEvent("profile:updated", { detail: { name: result.data.displayName } }),
        );
      } else {
        navigateAfterSave.current = null;
        const code = result.code;
        const message =
          code === "handle_unavailable"
            ? "That hub handle is already in use. Choose another."
            : code === "handle_reserved" || code === "handle_invalid"
              ? "Choose a different hub handle using lowercase letters, numbers and hyphens."
              : code === "unauthorized"
                ? "Your session ended. Continue with email before saving."
                : code === "too_many_requests"
                  ? "Too many attempts. Wait a minute, then save again."
                  : code === "validation_failed"
                    ? "Check your name and hub handle, then save again."
                    : "We couldn't confirm the save. Your edits are still here; try saving again.";
        setFeedback({ success: false, message, signIn: code === "unauthorized" });
      }
    } catch {
      navigateAfterSave.current = null;
      setFeedback({
        success: false,
        message: "We couldn't confirm the save. Your edits are still here; try saving again.",
      });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
    if (
      !enhanced ||
      !dirty ||
      saving ||
      !validFormat ||
      !draft.hubName.trim() ||
      ["checking", "taken", "reserved"].includes(handleState) ||
      (feedback && !feedback.success)
    )
      return;
    const timer = setTimeout(() => {
      if (form.current?.checkValidity()) form.current.requestSubmit();
    }, 800);
    return () => clearTimeout(timer);
  }, [enhanced, dirty, draft, saving, validFormat, handleState, feedback]);

  return (
    <>
      {!feedback && !dirty && notice !== "profile-saved" && <FormNotice code={notice} />}
      <form
        ref={form}
        action="/forms/profile-save"
        method="post"
        className="action-form"
        aria-busy={saving}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="account-fields">
          <fieldset className="account-field-group">
            <legend>Profile</legend>
            <div className="settings-field">
              <label htmlFor="display-name">Full name</label>
              <input
                id="display-name"
                name="displayName"
                maxLength={255}
                autoComplete="name"
                defaultValue={profile.displayName}
                onChange={edit}
              />
            </div>
            <div className="settings-toggle-row">
              <div>
                <label htmlFor="show-name-on-hub">Show my name on my hub</label>
                <p className="field-help" id="show-name-on-hub-help">
                  Show your full name beside your hub handle and on published collections.
                </p>
              </div>
              <div className="settings-toggle-control">
                <input
                  id="show-name-on-hub"
                  name="showNameOnHub"
                  type="checkbox"
                  // biome-ignore lint/a11y/useAriaPropsForRole: Native checkbox exposes checked state, including without JavaScript.
                  role="switch"
                  defaultChecked={profile.showNameOnHub}
                  onChange={edit}
                  aria-describedby="show-name-on-hub-help"
                />
                <span className="settings-toggle-track" aria-hidden="true" />
              </div>
            </div>
            <dl className="account-facts">
              <div>
                <dt>Email address</dt>
                <dd className="account-email">{profile.email}</dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>
                  <LocalTime at={profile.createdAt} variant="date" />
                </dd>
              </div>
            </dl>
          </fieldset>
          <fieldset className="account-field-group">
            <legend>Hub</legend>
            <div className="settings-field">
              <label htmlFor="hub-name">Hub name</label>
              <input
                id="hub-name"
                name="hubName"
                required
                maxLength={255}
                defaultValue={profile.hubName ?? ""}
                onChange={edit}
              />
            </div>
            <div className="settings-field">
              <label htmlFor="handle">Handle</label>
              <div className="settings-field-control">
                <input
                  id="handle"
                  name="handle"
                  required
                  minLength={3}
                  maxLength={60}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  title="3–60 lowercase letters, numbers and hyphens"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-describedby="handle-help handle-status"
                  aria-invalid={enhanced && ["invalid", "reserved", "taken"].includes(handleState)}
                  defaultValue={profile.handle ?? ""}
                  onChange={edit}
                />
                <p id="handle-help" className="field-help">
                  {handle !== saved.handle ? "New public address:" : "Your public address:"}{" "}
                  <span className="handle-preview">/@{handle}</span>
                </p>
                <p
                  id="handle-status"
                  className={`field-help handle-status ${["invalid", "reserved", "taken"].includes(handleState) ? "error" : handleState === "available" ? "success" : ""}`}
                  role="status"
                  hidden={!enhanced || handleState === "current"}
                >
                  {handleMessages[handleState]}
                </p>
              </div>
            </div>
            <div className="settings-field settings-field-wide">
              <label htmlFor="hub-description">Description</label>
              <textarea
                id="hub-description"
                name="hubDescription"
                rows={2}
                maxLength={5000}
                defaultValue={profile.hubDescription ?? ""}
                onChange={edit}
              />
            </div>
            <dl className="account-facts">
              <div>
                <dt>Hub ID</dt>
                <dd className="hub-id">
                  {profile.hubId ?? "Not available"}
                  <span className="field-help">Permanent. Name and handle can change.</span>
                </dd>
              </div>
            </dl>
            {saved.hubId && (
              <div className="hub-share-actions">
                {enhanced && <CopyHubLink hubId={saved.hubId} />}
                <a
                  href={`/h/${encodeURIComponent(saved.hubId)}?view=public`}
                  onClick={(event) => {
                    if (!enhanced || (!dirty && !saving)) return;
                    event.preventDefault();
                    if (!form.current?.reportValidity()) return;
                    navigateAfterSave.current = event.currentTarget.href;
                    if (!saving) form.current.requestSubmit();
                  }}
                >
                  View your public hub
                </a>
              </div>
            )}
          </fieldset>
        </div>
        <div className="profile-save-actions">
          <noscript>
            <button className="button primary" type="submit">
              Save changes
            </button>
          </noscript>
          <span
            className={`profile-save-status meta${savedFeedback ? " success" : ""}`}
            role="status"
          >
            {saving ? (
              "Saving…"
            ) : dirty ? (
              feedback?.success ? (
                "Newer changes aren't saved yet."
              ) : (
                "Unsaved changes"
              )
            ) : savedFeedback ? (
              <>
                <span aria-hidden="true">✓ </span>Saved
              </>
            ) : (
              ""
            )}
          </span>
        </div>
        {feedback && !feedback.success && (
          <div className="form-notice error" role="alert">
            <p>{feedback.message}</p>
            {enhanced && !feedback.signIn && (
              <button
                type="button"
                className="button"
                onClick={() => form.current?.requestSubmit()}
              >
                Retry
              </button>
            )}
            {feedback.signIn && <a href="/sign-in?returnTo=%2Fsettings">Sign in</a>}
          </div>
        )}
      </form>
    </>
  );
}
