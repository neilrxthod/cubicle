"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  LayoutGrid,
  Loader2,
  LogOut,
} from "lucide-react";
import { updateProfile, signOutAction } from "@/lib/actions";
import { fileToAvatarDataUrl } from "@/lib/profile/image";
import { isVerifiedStaff } from "@/lib/staff/employment";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
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
  settingsTextareaClass,
} from "@/components/settings/settings-section";

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
  /** Rendered after Profile (e.g. Google Calendar). */
  integrations?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
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
      setStatus({ type: "ok", message: "Photo ready — save to apply." });
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
    setStatus({ type: "ok", message: "Photo will be removed on save." });
  }

  function handleSave(event?: React.FormEvent) {
    event?.preventDefault();
    if (!dirty) return;
    setStatus(null);
    startTransition(async () => {
      const res = await updateProfile({
        name,
        title,
        department,
        phone,
        // Keep existing bio on server if any — field removed from UI (rarely used).
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
      setStatus({ type: "ok", message: "Saved" });
    });
  }

  const isAdmin = user.role === "admin";
  const roleLabel = isAdmin ? "Admin" : "Teacher";
  const displayName = name.trim() || user.name;
  const verified = isVerifiedStaff(user);

  return (
    <form onSubmit={handleSave} className="space-y-8 pb-28">
      {/* ── Profile ── */}
      <SettingsSection
        id="profile"
        title="Profile"
        description="How you appear on the board and bookings."
      >
        <SettingsRow>
          <div className="flex items-center gap-4 sm:gap-5">
            <button
              type="button"
              disabled={uploading || pending}
              onClick={() => fileRef.current?.click()}
              className="group relative shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-neutral-400"
              aria-label="Change photo"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-16 rounded-full object-cover ring-1 ring-black/[0.06] sm:size-[4.5rem]"
                />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-full bg-neutral-900 text-[1.125rem] font-semibold tracking-tight text-white sm:size-[4.5rem] sm:text-[1.25rem]">
                  {initials(displayName)}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-[11px] font-medium text-white opacity-0 transition-all group-hover:bg-black/45 group-hover:opacity-100">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Edit"
                )}
              </span>
              {verified ? (
                <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-white">
                  <VerifiedBadge size="sm" />
                </span>
              ) : null}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <p className="truncate text-[17px] font-semibold tracking-[-0.02em] text-neutral-950 sm:text-[18px]">
                  {displayName}
                </p>
                {verified ? <VerifiedBadge size="sm" /> : null}
              </div>
              <p className="mt-0.5 truncate text-[13px] text-neutral-500">
                {user.email}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                    isAdmin
                      ? "bg-violet-50 text-violet-700"
                      : "bg-emerald-50 text-emerald-700",
                  )}
                >
                  {roleLabel}
                </span>
                {verified ? (
                  <span className="text-[11.5px] font-medium text-[#1d9bf0]">
                    Verified staff
                  </span>
                ) : null}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
              />
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <button
                  type="button"
                  disabled={uploading || pending}
                  onClick={() => fileRef.current?.click()}
                  className="text-[12.5px] font-medium text-neutral-700 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Change photo
                </button>
                {avatarUrl ? (
                  <button
                    type="button"
                    disabled={uploading || pending}
                    onClick={removePhoto}
                    className="text-[12.5px] font-medium text-neutral-400 underline-offset-2 hover:text-red-600 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </SettingsRow>

        <SettingsDivider />

        <SettingsRow>
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Display name" htmlFor="name" className="sm:col-span-2">
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
                placeholder="e.g. Science teacher"
                autoComplete="organization-title"
              />
            </SettingsField>

            <SettingsField label="Department" htmlFor="department">
              <input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={settingsInputClass}
                placeholder="e.g. Science"
              />
            </SettingsField>

            <SettingsField
              label="Phone"
              htmlFor="phone"
              className="sm:col-span-2"
            >
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={settingsInputClass}
                placeholder="Optional — not shown on the board"
                autoComplete="tel"
              />
            </SettingsField>
          </div>
        </SettingsRow>
      </SettingsSection>

      {integrations}

      {/* ── Notifications ── */}
      <SettingsSection
        id="notifications"
        title="Email preferences"
        description="Optional alerts to your school Google account."
      >
        <SettingsToggleRow
          title="Booking updates"
          description="Upcoming reminders and cancellations"
          control={
            <Switch
              checked={notifyEmail}
              onCheckedChange={setNotifyEmail}
              aria-label="Booking reminders"
            />
          }
        />
        <SettingsDivider />
        <SettingsToggleRow
          title="Issue updates"
          description="Status changes on reports you filed"
          control={
            <Switch
              checked={notifyIssues}
              onCheckedChange={setNotifyIssues}
              aria-label="Issue updates"
            />
          }
        />
      </SettingsSection>

      {/* ── Account ── */}
      <SettingsSection
        id="account"
        title="Account"
        description="Managed by school Google and IT."
      >
        <SettingsMetaRow label="Email" value={user.email} />
        <SettingsDivider />
        <SettingsMetaRow label="Role" value={roleLabel} />
        <SettingsDivider />
        <SettingsMetaRow
          label="Verified"
          value={verified ? "Yes" : "No"}
          trailing={verified ? <VerifiedBadge size="sm" /> : undefined}
        />
        <SettingsDivider />
        <div className="px-4 py-3 sm:px-5">
          <p className="text-[12px] leading-relaxed text-neutral-400">
            {isAdmin
              ? "You can manage staff verification in Admin → Staff. Email domain stays @rbe.sk.ca."
              : "Ask IT or an admin if your name, role, or verified badge needs to change."}
          </p>
        </div>
      </SettingsSection>

      {/* ── Shortcuts ── */}
      <SettingsSection id="shortcuts" title="Shortcuts">
        <div className="divide-y divide-neutral-100">
          <Link
            href="/my-bookings"
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-neutral-50/80 sm:px-5"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
              <CalendarDays className="size-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-neutral-900">
                My bookings
              </span>
              <span className="block text-[12.5px] text-neutral-500">
                Upcoming cart reservations
              </span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-neutral-300" />
          </Link>
          {isAdmin ? (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-neutral-50/80 sm:px-5"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <LayoutGrid className="size-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-neutral-900">
                  Admin console
                </span>
                <span className="block text-[12.5px] text-neutral-500">
                  Carts, staff, restrictions, reports
                </span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-neutral-300" />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void signOutAction()}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-red-50/50 sm:px-5"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
              <LogOut className="size-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-neutral-900">
                Sign out
              </span>
              <span className="block text-[12.5px] text-neutral-500">
                End this session on this device
              </span>
            </span>
          </button>
        </div>
      </SettingsSection>

      {/* Sticky save */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-30 transition-[opacity,transform] duration-200",
          dirty || status
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0",
        )}
        aria-hidden={!dirty && !status}
      >
        <div className="border-t border-neutral-200/80 bg-white/92 backdrop-blur-xl">
          <div className="pointer-events-auto mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p
              role="status"
              className={cn(
                "min-h-[1.25rem] truncate text-[13px]",
                status?.type === "error"
                  ? "text-red-600"
                  : status?.type === "ok"
                    ? "text-neutral-600"
                    : "text-neutral-500",
              )}
            >
              {status?.message ?? (dirty ? "Unsaved changes" : "")}
            </p>
            <button
              type="submit"
              disabled={pending || uploading || !name.trim() || !dirty}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              ) : null}
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
