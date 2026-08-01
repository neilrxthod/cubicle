/**
 * Browser UI preferences (local only — not synced to the server).
 * Used for optional destructive actions and other local toggles.
 */

export const UI_PREFS_KEY = "cubicle-ui-prefs";
export const UI_PREFS_CHANGE_EVENT = "cubicle-ui-prefs";

export type UiPreferences = {
  /** When true, Issues list shows a Delete control. */
  allowIssueDelete?: boolean;
};

function read(): UiPreferences {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as UiPreferences;
  } catch {
    return {};
  }
}

function write(prefs: UiPreferences) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event(UI_PREFS_CHANGE_EVENT));
  } catch {
    // Quota / private mode — ignore
  }
}

export function getUiPreferences(): UiPreferences {
  return read();
}

export function setUiPreferences(partial: UiPreferences): UiPreferences {
  const next = { ...read(), ...partial };
  write(next);
  return next;
}
