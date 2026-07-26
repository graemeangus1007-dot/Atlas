"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/button";
import { isValidEmail, normalizeEmail } from "@/lib/leads/sanitize";
import type { PublicLeadFormSettings } from "@/lib/leads/types";
import { DEFAULT_EMAIL_SUBJECT_TEMPLATE } from "@/lib/leads/types";

type ContactFormNotificationsProps = {
  formId: string | null | undefined;
  projectId: string | null | undefined;
};

/**
 * Owner notification settings for the contact form (persisted on lead_forms).
 * Kept separate from project-content autosave so ensure/metadata never
 * overwrite in-progress typing of button/success copy.
 */
export default function ContactFormNotifications({
  formId,
  projectId,
}: ContactFormNotificationsProps) {
  const [settings, setSettings] = useState<PublicLeadFormSettings | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(DEFAULT_EMAIL_SUBJECT_TEMPLATE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!formId) {
      setSettings(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        settings?: PublicLeadFormSettings;
        error?: string;
      };
      if (!res.ok || !data.settings) {
        setError(data.error || "Could not load notification settings.");
        return;
      }
      setSettings(data.settings);
      setEnabled(data.settings.emailNotificationsEnabled);
      setEmail(data.settings.notificationEmail || "");
      setSubject(
        data.settings.emailSubjectTemplate || DEFAULT_EMAIL_SUBJECT_TEMPLATE,
      );
    } catch {
      setError("Could not load notification settings.");
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void load();
  }, [load]);

  function validateEmailField(value: string): boolean {
    const normalized = normalizeEmail(value);
    if (!normalized) {
      setEmailError("Notification email is required when notifications are on.");
      return false;
    }
    if (!isValidEmail(normalized)) {
      setEmailError("Enter a valid email address.");
      return false;
    }
    setEmailError(null);
    return true;
  }

  async function save() {
    if (!formId) return;
    if (enabled && !validateEmailField(email)) return;
    setSaving(true);
    setError(null);
    setOkMessage(null);
    try {
      const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailNotificationsEnabled: enabled,
          notificationEmail: email.trim() || null,
          emailSubjectTemplate: subject.trim() || DEFAULT_EMAIL_SUBJECT_TEMPLATE,
        }),
      });
      const data = (await res.json()) as {
        settings?: PublicLeadFormSettings;
        error?: string;
      };
      if (!res.ok || !data.settings) {
        setError(data.error || "Could not save notification settings.");
        return;
      }
      setSettings(data.settings);
      setOkMessage("Notification settings saved.");
    } catch {
      setError("Could not save notification settings.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!formId) return;
    if (!validateEmailField(email)) return;
    setTesting(true);
    setError(null);
    setOkMessage(null);
    try {
      // Persist current settings first so the test uses the field values.
      const saveRes = await fetch(`/api/forms/${encodeURIComponent(formId)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailNotificationsEnabled: enabled,
          notificationEmail: email.trim() || null,
          emailSubjectTemplate: subject.trim() || DEFAULT_EMAIL_SUBJECT_TEMPLATE,
        }),
      });
      const saveData = (await saveRes.json()) as {
        settings?: PublicLeadFormSettings;
        error?: string;
      };
      if (!saveRes.ok || !saveData.settings) {
        setError(saveData.error || "Could not save notification settings.");
        return;
      }
      setSettings(saveData.settings);

      const res = await fetch(
        `/api/forms/${encodeURIComponent(formId)}/test-notification`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationEmail: email.trim() }),
        },
      );
      const data = (await res.json()) as { error?: string; to?: string };
      if (!res.ok) {
        setError(data.error || "Could not send test notification.");
        void load();
        return;
      }
      setOkMessage(
        data.to
          ? `Test notification sent to ${data.to}.`
          : "Test notification sent.",
      );
      void load();
    } catch {
      setError("Could not send test notification.");
    } finally {
      setTesting(false);
    }
  }

  if (!formId || !projectId) {
    return (
      <p className="mt-4 text-xs text-muted">
        Save the project to configure email notifications.
      </p>
    );
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Email notifications
      </p>
      <p className="mt-1 text-xs text-muted">
        Get an email when someone submits this form. Delivery runs after the
        visitor sees success — failures never affect them.
      </p>

      {loading ? (
        <p className="mt-3 text-xs text-muted">Loading settings…</p>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable email notifications
          </label>

          <label className="block text-xs text-muted">
            Notification email
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              onBlur={() => {
                if (enabled || email.trim()) validateEmailField(email);
              }}
              placeholder="you@business.com"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            {emailError ? (
              <span className="mt-1 block text-xs text-red-400">{emailError}</span>
            ) : null}
          </label>

          <label className="block text-xs text-muted">
            Email subject template
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={DEFAULT_EMAIL_SUBJECT_TEMPLATE}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
            <span className="mt-1 block text-[11px] text-muted">
              Placeholders: {"{{name}}"}, {"{{email}}"}, {"{{project}}"}
            </span>
          </label>

          {settings?.lastNotificationError ? (
            <p className="text-xs text-amber-300" role="status">
              Last delivery issue: {settings.lastNotificationError}
            </p>
          ) : null}

          {error ? (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          {okMessage ? (
            <p className="text-xs text-accent" role="status">
              {okMessage}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="px-3 py-2 text-xs"
              disabled={saving || testing}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save notifications"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-2 text-xs"
              disabled={saving || testing || !enabled}
              onClick={() => void sendTest()}
            >
              {testing ? "Sending…" : "Send test notification"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
