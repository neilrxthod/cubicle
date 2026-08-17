"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Camera, Check, Loader2, LogOut } from "lucide-react";
import {
  deleteAccountAction,
  updateProfile,
  signOutAction,
} from "@/lib/actions";
import {
  getUiPreferences,
  setUiPreferences,
} from "@/lib/preferences/ui";
import { fileToAvatarDataUrl } from "@/lib/profile/image";
import { isVerifiedStaff } from "@/lib/staff/employment";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { VerifiedBadge } from "@/components/verified-badge";
import {
  SettingsDivider,
  SettingsMetaRow,
  SettingsSection,
  SettingsToggleRow,
} from "@/components/settings/settings-section";
import { SetupPreferences } from "@/components/settings/setup-preferences";
import { LocalEmailTestingSection } from "@/components/settings/local-email-testing";
import {
  getEmailDispatchStatus,
  type EmailDispatchStatus,
} from "@/lib/email/status";

const NAME_MAX = 80;

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0]?.slice(0, 2) ?? "U");
  return letters.toUpperCase();
}

export function SettingsForm({
  user,
  integrations,
}: {
  user: SessionUser;
  integrations?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const deleteConfirmRef = useRef<HTMLInputElement>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{
    type: "ok" | "error";
    message: string;
  } | null>(null);

  const [name, setName] = useState(user.name);
  const [editingName, setEditingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.avatarUrl);
  const [notifyEmail, setNotifyEmail] = useState(user.notifyEmail ?? true);
  const [notifyIssues, setNotifyIssues] = useState(user.notifyIssues ?? true);
  const [allowIssueDelete, setAllowIssueDelete] = useState(
    () => getUiPreferences().allowIssueDelete === true,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailDispatchStatus | null>(
    null,
  );

  const userStamp = `${user.name}\0${user.avatarUrl ?? ""}\0${user.notifyEmail}\0${user.notifyIssues}`;
  const [appliedUserStamp, setAppliedUserStamp] = useState(userStamp);
  const localDirty =
    name.trim() !== (user.name ?? "").trim() ||
    notifyEmail !== (user.notifyEmail ?? true) ||
    notifyIssues !== (user.notifyIssues ?? true);
  if (!editingName && !localDirty && userStamp !== appliedUserStamp) {
    setAppliedUserStamp(userStamp);
    setName(user.name);
    setAvatarUrl(user.avatarUrl);
    setNotifyEmail(user.notifyEmail ?? true);
    setNotifyIssues(user.notifyIssues ?? true);
  }

  // Focus + select when entering name edit (no layout thrash)
  useEffect(() => {
    if (!editingName) return;
    const el = nameInputRef.current;
    if (!el) return;
    // rAF: wait for input to mount before focus/select
    const id = requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(id);
  }, [editingName]);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getEmailDispatchStatus().then((next) => {
      if (!cancelled) setEmailStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function flashStatus(next: { type: "ok" | "error"; message: string }) {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatus(next);
    if (next.type === "ok") {
      statusTimerRef.current = setTimeout(() => {
        setStatus(null);
        statusTimerRef.current = null;
      }, 2200);
    }
  }

  function clearStatus() {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    setStatus(null);
  }

  // Only notification toggles use the floating save bar now —
  // name + photo auto-save silently on change.
  const dirty = useMemo(() => {
    if (notifyEmail !== (user.notifyEmail ?? true)) return true;
    if (notifyIssues !== (user.notifyIssues ?? true)) return true;
    return false;
  }, [notifyEmail, notifyIssues, user]);

  const busy = pending || uploading || deleting;
  const displayName = name.trim() || user.name;
  const verified = isVerifiedStaff(user);
  const isAdmin = user.role === "admin";
  const roleLabel = isAdmin ? "Admin" : "Teacher";
  const canConfirmDelete =
    deleteConfirm.trim().toLowerCase() === user.email.toLowerCase();
  const showSaveBar = dirty || status !== null;

  /** Shared profile fields for auto-saves that shouldn't clobber local notify drafts. */
  function baseProfilePayload() {
    return {
      title: user.title,
      department: user.department,
      ...(user.phone ? { phone: user.phone } : {}),
      bio: user.bio,
      notifyEmail: user.notifyEmail ?? true,
      notifyIssues: user.notifyIssues ?? true,
    };
  }

  /**
   * Persist photo immediately — silent success (no floating save bar).
   * Uses last-saved profile fields so unrelated drafts stay local.
   */
  async function persistAvatar(nextAvatar: string | null) {
    const res = await updateProfile({
      name: user.name,
      ...baseProfilePayload(),
      avatarUrl: nextAvatar,
    });
    if (!res.ok) {
      // Roll back preview to whatever is still on the profile
      setAvatarUrl(user.avatarUrl);
      flashStatus({
        type: "error",
        message: res.error || "Could not save photo.",
      });
      return false;
    }
    setAvatarUrl(res.data?.avatarUrl);
    return true;
  }

  /** Persist display name immediately — silent success (no floating save bar). */
  async function persistName(nextName: string) {
    const res = await updateProfile({
      name: nextName,
      ...baseProfilePayload(),
    });
    if (!res.ok) {
      setName(user.name);
      flashStatus({
        type: "error",
        message: res.error || "Could not save name.",
      });
      return false;
    }
    setName(res.data?.name ?? nextName);
    return true;
  }

  async function onPickPhoto(file: File | null) {
    if (!file || busy) return;
    setUploading(true);
    // Don't clear a notify draft status unrelated to photo —
    // only clear so we don't leave a prior "Saved" bar up while uploading.
    if (!dirty) clearStatus();
    const previous = avatarUrl;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarUrl(dataUrl);
      const ok = await persistAvatar(dataUrl);
      if (!ok) setAvatarUrl(previous);
    } catch (err) {
      setAvatarUrl(previous);
      flashStatus({
        type: "error",
        message:
          err instanceof Error ? err.message : "Could not use that image.",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePhoto() {
    if (busy || !avatarUrl) return;
    const previous = avatarUrl;
    if (!dirty) clearStatus();
    setAvatarUrl(undefined);
    setUploading(true);
    void (async () => {
      try {
        const ok = await persistAvatar(null);
        if (!ok) setAvatarUrl(previous);
      } finally {
        setUploading(false);
      }
    })();
  }

  function startEditName() {
    if (busy) return;
    setEditingName(true);
  }

  function commitNameDraft() {
    const next = name.trim().slice(0, NAME_MAX);
    setEditingName(false);

    if (!next) {
      setName(user.name);
      return;
    }

    // No-op if unchanged
    if (next === (user.name ?? "").trim()) {
      setName(next);
      return;
    }

    setName(next);
    if (!dirty) clearStatus();
    startTransition(async () => {
      const ok = await persistName(next);
      if (!ok) setName(user.name);
    });
  }

  function cancelNameEdit() {
    setName(user.name);
    setEditingName(false);
  }

  function handleNameChange(value: string) {
    setName(value.slice(0, NAME_MAX));
  }

  function handleNotifyEmail(checked: boolean) {
    clearStatus();
    setNotifyEmail(checked);
  }

  function handleNotifyIssues(checked: boolean) {
    clearStatus();
    setNotifyIssues(checked);
  }

  function handleSave(event?: React.FormEvent) {
    event?.preventDefault();
    // Name auto-saves on blur / Enter — only notification toggles use this bar.
    if (editingName) commitNameDraft();
    if (!dirty || busy) return;

    clearStatus();
    startTransition(async () => {
      const res = await updateProfile({
        name: user.name,
        title: user.title,
        department: user.department,
        ...(user.phone ? { phone: user.phone } : {}),
        bio: user.bio,
        notifyEmail,
        notifyIssues,
      });
      if (!res.ok) {
        flashStatus({
          type: "error",
          message: res.error || "Could not save.",
        });
        return;
      }
      flashStatus({ type: "ok", message: "Saved" });
    });
  }

  function handleDeleteAccount() {
    if (deleteConfirm.trim().toLowerCase() !== user.email.toLowerCase()) {
      setDeleteError("Type your email exactly to confirm.");
      return;
    }
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteAccountAction();
      if (!res.ok) {
        setDeleteError(res.error || "Could not delete account.");
      }
    });
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 pb-24">
      {/* Profile identity */}
      <SettingsSection id="profile">
        <div className="flex items-center gap-4 px-4 py-5 sm:gap-5 sm:px-5">
          <div className="relative shrink-0">
            <Avatar className="size-16 ring-1 ring-black/[0.06] sm:size-[4.5rem]">
              {avatarUrl ? (
                <AvatarImage
                  src={avatarUrl}
                  alt=""
                  className="object-cover [image-rendering:auto]"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <AvatarFallback className="bg-neutral-900 text-[15px] font-medium tracking-tight text-white sm:text-[16px]">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
            {uploading ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30">
                <Loader2
                  className="size-4 animate-spin text-white"
                  strokeWidth={2}
                />
              </span>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-h-[1.5rem] min-w-0 items-center">
              {editingName ? (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                  <span className="inline-grid max-w-full align-middle">
                    <span
                      aria-hidden
                      className={cn(
                        "invisible col-start-1 row-start-1 whitespace-pre",
                        "border-b border-transparent pb-px",
                        "text-[16px] font-medium tracking-[-0.02em]",
                      )}
                    >
                      {name || " "}
                    </span>
                    <input
                      ref={nameInputRef}
                      id="name"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onBlur={() => {
                        // Defer so Enter keydown can finish first without double-commit races
                        requestAnimationFrame(() => {
                          if (document.activeElement !== nameInputRef.current) {
                            commitNameDraft();
                          }
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          commitNameDraft();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          cancelNameEdit();
                        }
                      }}
                      disabled={busy}
                      autoComplete="name"
                      aria-label="Display name"
                      maxLength={NAME_MAX}
                      size={1}
                      className={cn(
                        "col-start-1 row-start-1 w-full min-w-[1.5ch] bg-transparent p-0",
                        "border-0 border-b border-neutral-900 pb-px",
                        "text-[16px] font-medium tracking-[-0.02em] text-neutral-950",
                        "outline-none ring-0 shadow-none",
                        "caret-neutral-900",
                        "placeholder:text-neutral-300",
                        "disabled:opacity-50",
                      )}
                      placeholder="Name"
                    />
                  </span>
                  {verified ? (
                    <VerifiedBadge size="sm" className="shrink-0" />
                  ) : null}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={startEditName}
                  disabled={busy}
                  className={cn(
                    "group/name inline-flex min-w-0 max-w-full items-center gap-1",
                    "text-left outline-none disabled:opacity-50",
                  )}
                  aria-label="Edit name"
                >
                  <h2
                    className={cn(
                      "min-w-0 truncate text-[16px] font-medium tracking-[-0.02em] text-neutral-950",
                      "border-b border-transparent pb-px",
                      "transition-[border-color] duration-150",
                      "group-hover/name:border-neutral-300",
                      "group-focus-visible/name:border-neutral-400",
                    )}
                  >
                    {displayName}
                  </h2>
                  {verified ? (
                    <VerifiedBadge size="sm" className="shrink-0" />
                  ) : null}
                </button>
              )}
            </div>

            <p className="mt-0.5 truncate text-[13px] tracking-[-0.01em] text-neutral-500">
              {user.email}
            </p>

            <span
              className={cn(
                "mt-2.5 inline-flex h-5 items-center rounded-full px-2",
                "bg-neutral-950 text-[10.5px] font-medium tracking-[0.04em] text-white",
              )}
            >
              {roleLabel}
            </span>
          </div>
        </div>

        <SettingsDivider />

        <div className="flex items-center gap-1 px-2 py-1.5 sm:px-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5",
              "text-[12.5px] font-medium tracking-[-0.01em] text-neutral-600",
              "transition-colors duration-150",
              "hover:bg-neutral-50 hover:text-neutral-950",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <Camera className="size-3.5 text-neutral-400" strokeWidth={1.75} />
            {avatarUrl ? "Change photo" : "Upload photo"}
          </button>

          {avatarUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={removePhoto}
              className={cn(
                "inline-flex h-8 items-center rounded-lg px-2.5",
                "text-[12.5px] font-medium tracking-[-0.01em] text-neutral-500",
                "transition-colors duration-150",
                "hover:bg-red-50 hover:text-red-700",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/15",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              Remove
            </button>
          ) : null}
        </div>

        <input
          ref={fileRef}
          id="settings-photo"
          name="photo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
        />
      </SettingsSection>

      {integrations}

      <SetupPreferences user={user} />

      <SettingsSection id="notifications" title="Email notifications">
        {emailStatus ? (
          <>
            <p
              className={cn(
                "px-4 py-3 text-[12.5px] leading-relaxed sm:px-5",
                emailStatus.live
                  ? "text-neutral-500"
                  : emailStatus.configured
                    ? "text-neutral-500"
                    : "text-amber-800/80",
              )}
            >
              {emailStatus.live
                ? "Live on this deployment. Staff receive mail for the events you leave on below."
                : emailStatus.configured
                  ? "Provider is configured. Local testing still has to be enabled to send."
                  : "Email is not configured on this deployment yet. Add BREVO_API_KEY and BREVO_SENDER_EMAIL on Vercel Production."}
            </p>
            <SettingsDivider />
          </>
        ) : null}
        <SettingsToggleRow
          title="Schedule email"
          description="Shares, swaps, booking moves, and cancellations"
          control={
            <Switch
              checked={notifyEmail}
              onCheckedChange={handleNotifyEmail}
              disabled={busy}
              aria-label="Schedule email"
            />
          }
        />
        {isAdmin ? (
          <>
            <SettingsDivider />
            <SettingsToggleRow
              title="Issue email"
              description="When a teacher reports a cart issue"
              control={
                <Switch
                  checked={notifyIssues}
                  onCheckedChange={handleNotifyIssues}
                  disabled={busy}
                  aria-label="Issue email"
                />
              }
            />
          </>
        ) : null}
      </SettingsSection>

      <LocalEmailTestingSection />

      <SettingsSection id="issues" title="Issues">
        <SettingsToggleRow
          title="Allow deleting issues"
          description="Show a Delete control on the Issues page. Deletes are permanent."
          control={
            <Switch
              checked={allowIssueDelete}
              onCheckedChange={(checked) => {
                setAllowIssueDelete(checked);
                setUiPreferences({ allowIssueDelete: checked });
              }}
              aria-label="Allow deleting issues"
            />
          }
        />
      </SettingsSection>

      <SettingsSection id="account" title="Account">
        <SettingsMetaRow label="Email" value={user.email} />
        <SettingsDivider />
        <SettingsMetaRow label="Role" value={roleLabel} />
        <SettingsDivider />
        <SettingsMetaRow
          label="Verified"
          value={verified ? "Yes" : "No"}
          trailing={verified ? <VerifiedBadge size="xs" /> : undefined}
        />
        <SettingsDivider />
        <button
          type="button"
          onClick={() => void signOutAction()}
          disabled={busy}
          className={cn(
            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13.5px]",
            "transition-colors hover:bg-neutral-50/80 sm:px-5",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <span className="inline-flex items-center gap-2 font-medium tracking-[-0.01em] text-neutral-900">
            <LogOut className="size-3.5 text-neutral-400" strokeWidth={1.75} />
            Sign out
          </span>
        </button>
      </SettingsSection>

      <SettingsSection
        id="danger"
        title="Danger zone"
        titleClassName="text-red-600/80"
        cardClassName="border-red-200/80"
      >
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-5">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium tracking-[-0.01em] text-neutral-900">
              Delete account
            </p>
            <p className="mt-1 max-w-md text-[12px] leading-relaxed text-neutral-400">
              Permanently remove your school access, profile, and sign-in for{" "}
              <span className="font-medium text-neutral-500">{user.email}</span>.
              This action cannot be undone.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDeleteConfirm("");
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className={cn(
              "inline-flex h-8 shrink-0 items-center justify-center self-start rounded-md border border-red-300/90 bg-white px-3",
              "text-[12.5px] font-medium tracking-[-0.01em] text-red-700",
              "transition-colors duration-150",
              "hover:border-red-400 hover:bg-red-50/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/20",
              "disabled:pointer-events-none disabled:opacity-50",
              "sm:self-center",
            )}
          >
            Delete account
          </button>
        </div>
      </SettingsSection>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deleting) return;
          setDeleteOpen(open);
          if (!open) {
            setDeleteConfirm("");
            setDeleteError(null);
          } else {
            // Focus confirm field after the dialog paints
            requestAnimationFrame(() => {
              deleteConfirmRef.current?.focus();
            });
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-0 shadow-[0_16px_48px_rgba(0,0,0,0.12)] sm:max-w-[420px]">
          <DialogHeader className="space-y-0 border-b border-black/[0.06] px-5 pb-4 pt-5 text-left">
            <DialogTitle className="text-[15px] font-medium tracking-[-0.02em] text-neutral-950">
              Delete account
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-500">
              This permanently closes your Cubicle account. School IT will need
              to re-invite your email if you require access again.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-5 py-5">
            <div className="rounded-[12px] border border-black/[0.06] bg-[#fafafa] px-3.5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-400">
                Account
              </p>
              <p className="mt-1.5 truncate text-[13.5px] font-medium tracking-[-0.01em] text-neutral-900">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-neutral-500">
                {user.email}
              </p>
            </div>

            <ul className="flex flex-col gap-2 text-[12.5px] leading-snug text-neutral-500">
              <li className="flex gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-300"
                />
                Sign-in with Google will stop working for this product
              </li>
              <li className="flex gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-300"
                />
                Profile details and preferences will be removed
              </li>
              <li className="flex gap-2.5">
                <span
                  aria-hidden
                  className="mt-1.5 size-1 shrink-0 rounded-full bg-neutral-300"
                />
                Bookings and issues linked to you may be removed
              </li>
            </ul>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="delete-confirm-email"
                className="block text-[12px] font-medium tracking-[-0.01em] text-neutral-700"
              >
                Type{" "}
                <span className="font-medium text-neutral-950">
                  {user.email}
                </span>{" "}
                to confirm
              </label>
              <div className="relative">
                <input
                  ref={deleteConfirmRef}
                  id="delete-confirm-email"
                  type="email"
                  inputMode="email"
                  value={deleteConfirm}
                  onChange={(e) => {
                    setDeleteConfirm(e.target.value);
                    setDeleteError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (canConfirmDelete && !deleting) {
                        handleDeleteAccount();
                      }
                    }
                  }}
                  placeholder="your@school.email"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={deleting}
                  aria-invalid={Boolean(deleteError) || undefined}
                  aria-describedby={
                    deleteError
                      ? "delete-confirm-error"
                      : canConfirmDelete
                        ? "delete-confirm-match"
                        : undefined
                  }
                  className={cn(
                    "h-10 w-full rounded-lg border bg-white px-3 pr-9",
                    "text-[13.5px] tracking-[-0.011em] text-neutral-900",
                    "placeholder:text-neutral-400",
                    "outline-none transition-[border-color,background-color] duration-150",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    // Thin solid line only — no soft focus glow / double ring
                    deleteError
                      ? "border-red-400 focus:border-red-500"
                      : canConfirmDelete
                        ? "border-neutral-900 focus:border-neutral-900"
                        : "border-neutral-200 hover:border-neutral-300 focus:border-neutral-400",
                  )}
                />
                {canConfirmDelete ? (
                  <span
                    id="delete-confirm-match"
                    className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-neutral-900"
                    aria-live="polite"
                  >
                    <Check className="size-3.5" strokeWidth={2.25} />
                    <span className="sr-only">Email matches</span>
                  </span>
                ) : null}
              </div>
              {deleteError ? (
                <p
                  id="delete-confirm-error"
                  role="alert"
                  className="text-[12px] leading-snug text-red-600"
                >
                  {deleteError}
                </p>
              ) : (
                <p className="text-[11.5px] leading-snug text-neutral-400">
                  Delete stays locked until the email matches exactly.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-black/[0.05] pt-4">
              <DialogCancel
                disabled={deleting}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </DialogCancel>
              <button
                type="button"
                disabled={deleting || !canConfirmDelete}
                onClick={handleDeleteAccount}
                className={cn(
                  "inline-flex h-9 min-w-[8.25rem] items-center justify-center rounded-md px-3.5",
                  "bg-red-600 text-[12.5px] font-medium tracking-[-0.01em] text-white",
                  "transition-[opacity,background-color] duration-150 ease-out",
                  "hover:bg-red-700",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500",
                  "disabled:pointer-events-none disabled:opacity-35",
                )}
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin opacity-90" />
                ) : (
                  "Delete account"
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating save — only interactive when visible */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4",
          "transition-[opacity,transform] duration-200 ease-out",
          "pb-[env(safe-area-inset-bottom,0px)]",
          showSaveBar
            ? "translate-y-0 opacity-100"
            : "translate-y-3 opacity-0",
        )}
        aria-hidden={!showSaveBar}
      >
        <div
          className={cn(
            "flex items-center gap-3 rounded-full border border-black/[0.08]",
            "bg-white/95 py-1.5 pl-4 pr-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl",
            showSaveBar ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          <p
            role="status"
            aria-live="polite"
            className={cn(
              "max-w-[10rem] truncate text-[12.5px] sm:max-w-[14rem]",
              status?.type === "error" ? "text-red-600" : "text-neutral-500",
            )}
          >
            {status?.message ?? (dirty ? "Unsaved changes" : "")}
          </p>
          <button
            type="submit"
            disabled={busy || !name.trim() || !dirty}
            className={cn(
              "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full",
              "bg-neutral-900 px-3.5 text-[12.5px] font-medium text-white",
              "transition-opacity hover:opacity-90 disabled:opacity-30",
            )}
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" strokeWidth={2} />
            ) : null}
            {pending ? "Saving" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
