"use client";

import { useEffect, useState } from "react";
import {
  getLocalEmailPrefs,
  isValidLocalTestEmail,
  setLocalEmailPrefs,
  showLocalEmailTestingUi,
  type LocalEmailPrefs,
} from "@/lib/email/local-dev";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  SettingsSection,
  SettingsToggleRow,
  settingsInputClass,
} from "@/components/settings/settings-section";

/**
 * Local-only email sink controls. Hidden on production.
 */
export function LocalEmailTestingSection() {
  const [visible, setVisible] = useState(false);
  const [prefs, setPrefs] = useState<LocalEmailPrefs>({
    enabled: false,
    testEmail: "",
  });
  const [draftEmail, setDraftEmail] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!showLocalEmailTestingUi()) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const next = getLocalEmailPrefs();
    setPrefs(next);
    setDraftEmail(next.testEmail);
  }, []);

  if (!visible) return null;

  const emailValid =
    draftEmail.trim() === "" || isValidLocalTestEmail(draftEmail);
  const dirty = draftEmail.trim() !== prefs.testEmail;
  const canSave =
    dirty && emailValid && (draftEmail.trim() === "" || isValidLocalTestEmail(draftEmail));

  function onSave() {
    const email = draftEmail.trim();
    if (email && !isValidLocalTestEmail(email)) return;
    const next = setLocalEmailPrefs({ testEmail: email });
    setPrefs(next);
    setDraftEmail(next.testEmail);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <SettingsSection
      id="local-email"
      title="Email notifications (local testing)"
      titleClassName="text-amber-800/75"
      cardClassName="border-amber-200/80 bg-amber-50/40"
    >
      <SettingsToggleRow
        title="Enable"
        description="Route local mail to the address below"
        control={
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(checked) => {
              const next = setLocalEmailPrefs({ enabled: checked });
              setPrefs(next);
            }}
            aria-label="Enable local email notifications"
          />
        }
      />

      <div className="mx-4 h-px bg-amber-200/70 sm:mx-5" role="separator" aria-hidden />

      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
        <input
          id="local-email-sink"
          type="email"
          autoComplete="email"
          spellCheck={false}
          placeholder="you@example.com"
          value={draftEmail}
          onChange={(e) => setDraftEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSave();
            }
          }}
          aria-label="Notification email"
          className={cn(
            settingsInputClass,
            "border-amber-200/90 bg-white sm:flex-1",
            "hover:border-amber-300 focus:border-amber-400 focus:shadow-[0_0_0_3px_rgba(251,191,36,0.15)]",
            draftEmail && !emailValid && "border-red-300 focus:border-red-400",
          )}
        />
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className={cn(
            "h-9 shrink-0 rounded-[10px] px-4 text-[13px] font-medium tracking-[-0.01em] transition-colors",
            canSave
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "cursor-not-allowed bg-amber-100 text-amber-400",
          )}
        >
          {savedFlash ? "Saved" : "Save"}
        </button>
      </div>
    </SettingsSection>
  );
}
