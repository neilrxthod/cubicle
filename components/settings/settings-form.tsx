"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { VerifiedBadge } from "@/components/verified-badge";
import {
  SettingsDivider,
  SettingsField,
  SettingsMetaRow,
  SettingsRow,
  SettingsSection,
  SettingsToggleRow,
  settingsInputClass,
} from "@/components/settings/settings-section";
import { SetupPreferences } from "@/components/settings/setup-preferences";

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
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{
    type: "ok" | "error";
    message: string;
  } | null>(null);

  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title ?? "");
  const [department, setDepartment] = useState(user.department ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.avatarUrl);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(user.notifyEmail ?? true);
  const [notifyIssues, setNotifyIssues] = useState(user.notifyIssues ?? true);
  const [allowIssueDelete, setAllowIssueDelete] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setAllowIssueDelete(getUiPreferences().allowIssueDelete === true);
  }, []);

  const dirty = useMemo(() => {
    if (avatarDirty) return true;
    if (name.trim() !== user.name) return true;
    if ((title || "") !== (user.title ?? "")) return true;
    if ((department || "") !== (user.department ?? "")) return true;
    if ((phone || "") !== (user.phone ?? "")) return true;
    if (notifyEmail !== (user.notifyEmail ?? true)) return true;
    if (notifyIssues !== (user.notifyIssues ?? true)) return true;
    return false;
  }, [
    avatarDirty,
    name,
    title,
    department,
    phone,
    notifyEmail,
    notifyIssues,
    user,
  ]);

  async function onPickPhoto(file: File | null) {
    if (!file) return;
    setUploading(true);
    setStatus(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarUrl(dataUrl);
      setAvatarDirty(true);
    } catch (err) {
      setStatus({
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
    setAvatarUrl(undefined);
    setAvatarDirty(true);
  }

  function handleSave(event?: React.FormEvent) {
    event?.preventDefault();
    if (!dirty) return;
    if (!phone.trim()) {
      setStatus({
        type: "error",
        message: "Phone number is required.",
      });
      return;
    }
    setStatus(null);
    startTransition(async () => {
      const res = await updateProfile({
        name,
        title,
        department,
        phone,
        bio: user.bio,
        avatarUrl: avatarDirty ? (avatarUrl ?? null) : undefined,
        notifyEmail,
        notifyIssues,
      });
      if (!res.ok) {
        setStatus({ type: "error", message: res.error || "Could not save." });
        return;
      }
      setAvatarDirty(false);
      setStatus({ type: "ok", message: "Profile saved" });
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
      // On success the action redirects to /login
    });
  }

  const isAdmin = user.role === "admin";
  const roleLabel = isAdmin ? "Admin" : "Teacher";
  const displayName = name.trim() || user.name;
  const verified = isVerifiedStaff(user);
  const canConfirmDelete =
    deleteConfirm.trim().toLowerCase() === user.email.toLowerCase();

  return (
    <form onSubmit={handleSave} className="space-y-6 pb-24">
      {/* Identity — hero, no card chrome */}
      <div className="flex items-center gap-4 px-0.5">
        <button
          type="button"
          disabled={uploading || pending}
          onClick={() => fileRef.current?.click()}
          className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20 focus-visible:ring-offset-2"
          aria-label="Change photo"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-14 rounded-full object-cover ring-1 ring-black/[0.06]"
            />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-neutral-900 text-[15px] font-medium tracking-tight text-white">
              {initials(displayName)}
            </span>
          )}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-[10px] font-medium uppercase tracking-wide text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
            {uploading ? <Loader2 className="size-3.5 animate-spin" /> : "Edit"}
          </span>
          {verified ? (
            <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-white ring-2 ring-white">
              <VerifiedBadge size="xs" />
            </span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[15px] font-light tracking-[-0.02em] text-neutral-950">
              {displayName}
            </h2>
            {verified ? <VerifiedBadge size="sm" /> : null}
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-neutral-400">
            {user.email}
          </p>
          <p className="mt-1 text-[11.5px] font-medium text-neutral-400">
            {roleLabel}
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
        />
        <div className="flex shrink-0 flex-col items-end gap-1">
          <button
            type="button"
            disabled={uploading || pending}
            onClick={() => fileRef.current?.click()}
            className="text-[12px] font-medium text-neutral-600 transition-colors hover:text-neutral-950 disabled:opacity-50"
          >
            Photo
          </button>
          {avatarUrl ? (
            <button
              type="button"
              disabled={uploading || pending}
              onClick={removePhoto}
              className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      {/* Profile fields */}
      <SettingsSection id="profile" title="Profile">
        <SettingsRow>
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsField label="Name" htmlFor="name" className="sm:col-span-2">
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={settingsInputClass}
                placeholder="Full name"
                required
                autoComplete="name"
              />
            </SettingsField>
            <SettingsField label="Title" htmlFor="title">
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={settingsInputClass}
                placeholder="Science teacher"
                autoComplete="organization-title"
              />
            </SettingsField>
            <SettingsField label="Department" htmlFor="department">
              <input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={settingsInputClass}
                placeholder="Science"
              />
            </SettingsField>
            <SettingsField label="Phone" htmlFor="phone" className="sm:col-span-2">
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={settingsInputClass}
                placeholder="Classroom or office line"
                required
                autoComplete="tel"
                aria-required="true"
              />
              <p className="text-[11.5px] leading-snug text-neutral-400">
                Required — each classroom teacher has a dedicated number.
              </p>
            </SettingsField>
          </div>
        </SettingsRow>
      </SettingsSection>

      {integrations}

      {/* First-run onboarding data — edit anytime without reopening the wizard */}
      <SetupPreferences user={user} />

      <SettingsSection id="notifications" title="Email">
        <SettingsToggleRow
          title="Account email"
          description="Booking, profile, and access changes"
          control={
            <Switch
              checked={notifyEmail}
              onCheckedChange={setNotifyEmail}
              aria-label="Account email"
            />
          }
        />
        <SettingsDivider />
        <SettingsToggleRow
          title="Issue email"
          description="Status changes on issues you reported"
          control={
            <Switch
              checked={notifyIssues}
              onCheckedChange={setNotifyIssues}
              aria-label="Issue email"
            />
          }
        />
      </SettingsSection>

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
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13.5px] transition-colors hover:bg-neutral-50/80 sm:px-5"
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
              "sm:self-center",
            )}
          >
            Delete account
          </button>
        </div>
      </SettingsSection>

      <p className="px-1 text-center text-[11.5px] leading-relaxed text-neutral-400">
        {isAdmin
          ? "Staff verification is managed in Admin → Staff."
          : "Role and verification are managed by school IT."}
      </p>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deleting) return;
          setDeleteOpen(open);
          if (!open) {
            setDeleteConfirm("");
            setDeleteError(null);
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

            <ul className="space-y-2 text-[12.5px] leading-snug text-neutral-500">
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

            <div className="space-y-1.5">
              <label
                htmlFor="delete-confirm-email"
                className="block text-[11.5px] font-medium tracking-[-0.01em] text-neutral-400"
              >
                Type your email to confirm
              </label>
              <input
                id="delete-confirm-email"
                type="email"
                value={deleteConfirm}
                onChange={(e) => {
                  setDeleteConfirm(e.target.value);
                  setDeleteError(null);
                }}
                placeholder={user.email}
                autoComplete="off"
                spellCheck={false}
                disabled={deleting}
                className={settingsInputClass}
              />
            </div>

            {deleteError ? (
              <p role="alert" className="text-[12.5px] text-red-600">
                {deleteError}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-3 border-t border-black/[0.05] pt-4">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteOpen(false)}
                className="h-9 px-2 text-[13px] font-medium text-neutral-500 transition-colors duration-150 hover:text-neutral-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting || !canConfirmDelete}
                onClick={handleDeleteAccount}
                className={cn(
                  "inline-flex h-9 min-w-[8.25rem] items-center justify-center rounded-md px-3.5",
                  "bg-red-600 text-[12.5px] font-medium tracking-[-0.01em] text-white",
                  "transition-[opacity,background-color] duration-150 ease-out",
                  "hover:bg-red-700",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30",
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

      {/* Floating save — pill, only when needed */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 transition-all duration-200",
          dirty || status
            ? "translate-y-0 opacity-100"
            : "translate-y-3 opacity-0",
        )}
        aria-hidden={!dirty && !status}
      >
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-black/[0.08] bg-white/95 py-1.5 pl-4 pr-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl">
          <p
            role="status"
            className={cn(
              "max-w-[10rem] truncate text-[12.5px] sm:max-w-[14rem]",
              status?.type === "error"
                ? "text-red-600"
                : status?.type === "ok"
                  ? "text-neutral-500"
                  : "text-neutral-500",
            )}
          >
            {status?.message ?? (dirty ? "Unsaved" : "")}
          </p>
          <button
            type="submit"
            disabled={
              pending || uploading || !name.trim() || !phone.trim() || !dirty
            }
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-3.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
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
