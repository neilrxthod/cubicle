"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getLocalEmailPrefs,
  isValidLocalTestEmail,
  setLocalEmailPrefs,
  showLocalEmailTestingUi,
  type LocalEmailPrefs,
} from "@/lib/email/local-dev";
import { sendLocalTestEmail } from "@/lib/email/queue";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  SettingsDivider,
  SettingsField,
  SettingsSection,
  SettingsToggleRow,
  settingsInputClass,
} from "@/components/settings/settings-section";

/**
 * Local-only engineer controls for Brevo.
 * Hidden on production hosts. Defaults: no sends until toggle is on.
 */
export function LocalEmailTestingSection() {
  const [visible, setVisible] = useState(false);
  const [prefs, setPrefs] = useState<LocalEmailPrefs>({
    enabled: false,
    testEmail: "",
  });
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    type: "ok" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!showLocalEmailTestingUi()) {
      setVisible(false);
      return;
    }
    setVisible(true);
    setPrefs(getLocalEmailPrefs());
  }, []);

  if (!visible) return null;

  const emailValid = isValidLocalTestEmail(prefs.testEmail);
  const canSendTest = prefs.enabled && emailValid && !pending;

  function persist(partial: Partial<LocalEmailPrefs>) {
    const next = setLocalEmailPrefs(partial);
    setPrefs(next);
    setStatus(null);
  }

  function onSendTest() {
    setStatus(null);
    startTransition(async () => {
      const result = await sendLocalTestEmail();
      if (!result.ok) {
        setStatus({
          type: "error",
          message: result.error ?? "Could not send test email.",
        });
        return;
      }
      if (result.skipped) {
        setStatus({
          type: "error",
          message:
            result.reason ??
            "Brevo skipped the send. Check BREVO_API_KEY and BREVO_SENDER_EMAIL in .env.local.",
        });
        return;
      }
      setStatus({
        type: "ok",
        message: `Test email sent to ${prefs.testEmail.trim()}.`,
      });
    });
  }

  return (
    <SettingsSection
      id="local-email"
      title="Email (local testing)"
      titleClassName="text-amber-800/70"
      cardClassName="border-amber-200/70"
    >
      <div className="border-b border-amber-100 bg-amber-50/50 px-4 py-2.5 sm:px-5">
        <p className="text-[12px] leading-snug text-amber-900/70">
          Local development only. Off by default — nothing is sent via Brevo
          until you enable this and set a sink address. Production never uses
          these settings.
        </p>
      </div>

      <SettingsToggleRow
        title="Send test emails"
        description="When on, notification mail goes only to your sink address"
        control={
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(checked) => persist({ enabled: checked })}
            aria-label="Send test emails in local development"
          />
        }
      />

      <SettingsDivider />

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <SettingsField label="Sink email" htmlFor="local-email-sink">
          <input
            id="local-email-sink"
            type="email"
            autoComplete="email"
            spellCheck={false}
            placeholder="you@example.com"
            value={prefs.testEmail}
            onChange={(e) => {
              setPrefs((p) => ({ ...p, testEmail: e.target.value }));
            }}
            onBlur={() => persist({ testEmail: prefs.testEmail })}
            className={cn(
              settingsInputClass,
              prefs.testEmail &&
                !emailValid &&
                "border-red-300 focus:border-red-400",
            )}
          />
        </SettingsField>
        <p className="text-[11.5px] leading-snug text-neutral-400">
          All local notifications (issues, share invites) are rewritten to this
          inbox. School staff never receive them from this machine.
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={!canSendTest}
            onClick={onSendTest}
            className={cn(
              "h-8 rounded-md px-3 text-[12.5px] font-medium transition-colors",
              canSendTest
                ? "bg-neutral-950 text-white hover:bg-neutral-800"
                : "cursor-not-allowed bg-neutral-100 text-neutral-400",
            )}
          >
            {pending ? "Sending…" : "Send test email"}
          </button>
          {prefs.enabled && !emailValid ? (
            <span className="text-[12px] text-neutral-400">
              Enter a valid email to enable sending
            </span>
          ) : null}
        </div>

        {status ? (
          <p
            role="status"
            className={cn(
              "text-[12.5px]",
              status.type === "ok" ? "text-emerald-700" : "text-red-600",
            )}
          >
            {status.message}
          </p>
        ) : null}
      </div>
    </SettingsSection>
  );
}
