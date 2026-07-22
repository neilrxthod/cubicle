"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { updateProfile } from "@/lib/actions";
import { fileToAvatarDataUrl } from "@/lib/profile/image";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0]?.slice(0, 2) ?? "U");
  return letters.toUpperCase();
}

const inputClass =
  "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] text-neutral-900 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/[0.06]";

const labelClass = "text-[13px] font-medium text-neutral-700";

export function SettingsForm({ user }: { user: SessionUser }) {
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
  const [bio, setBio] = useState(user.bio ?? "");
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
    if ((bio || "") !== (user.bio ?? "")) return true;
    if (notifyEmail !== (user.notifyEmail ?? true)) return true;
    if (notifyIssues !== (user.notifyIssues ?? true)) return true;
    return false;
  }, [
    avatarDirty,
    name,
    title,
    department,
    phone,
    bio,
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
      setStatus({
        type: "ok",
        message: "Photo ready — click Save to apply.",
      });
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
    setStatus({ type: "ok", message: "Photo will be removed when you save." });
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setStatus(null);
    startTransition(async () => {
      const res = await updateProfile({
        name,
        title,
        department,
        phone,
        bio,
        avatarUrl: avatarDirty ? (avatarUrl ?? null) : undefined,
        notifyEmail,
        notifyIssues,
      });
      if (!res.ok) {
        setStatus({
          type: "error",
          message: res.error || "Could not save.",
        });
        return;
      }
      setAvatarDirty(false);
      setStatus({ type: "ok", message: "Saved." });
    });
  }

  const roleLabel = user.role === "admin" ? "Admin" : "Teacher";

  return (
    <form onSubmit={handleSave} className="pb-24">
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white">
        {/* Identity header — who you are at a glance */}
        <div className="border-b border-neutral-100 px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative shrink-0 self-start">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-16 rounded-full object-cover ring-1 ring-black/[0.06] sm:size-[4.5rem]"
                />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-full bg-neutral-950 text-[1.125rem] font-semibold tracking-tight text-white sm:size-[4.5rem] sm:text-[1.25rem]">
                  {initials(name || user.name)}
                </span>
              )}
              {uploading ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Loader2 className="size-5 animate-spin text-white" />
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[1.125rem] font-semibold tracking-[-0.02em] text-neutral-950">
                  {name.trim() || user.name}
                </h2>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                    user.role === "admin"
                      ? "bg-violet-50 text-violet-700"
                      : "bg-emerald-50 text-emerald-700",
                  )}
                >
                  {roleLabel}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[13.5px] text-neutral-500">
                {user.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  disabled={uploading || pending}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-[12.5px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                >
                  <Camera className="size-3.5" strokeWidth={1.75} />
                  Change photo
                </button>
                {avatarUrl ? (
                  <button
                    type="button"
                    disabled={uploading || pending}
                    onClick={removePhoto}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Profile fields — what shows on bookings */}
        <div className="space-y-5 border-b border-neutral-100 px-5 py-6 sm:px-7">
          <div>
            <h3 className="text-[13px] font-semibold tracking-tight text-neutral-950">
              How you appear
            </h3>
            <p className="mt-0.5 text-[13px] text-neutral-500">
              Name shows on bookings and issues. Keep it current so IT and
              colleagues know who reserved a cart.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="name" className={labelClass}>
                Display name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Your name"
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="title" className={labelClass}>
                Role / title
              </label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="e.g. Science teacher"
                autoComplete="organization-title"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="department" className={labelClass}>
                Department
              </label>
              <input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={inputClass}
                placeholder="e.g. Science"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="phone" className={labelClass}>
                Phone{" "}
                <span className="font-normal text-neutral-400">(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder="School or work number"
                autoComplete="tel"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="bio" className={labelClass}>
                  Note{" "}
                  <span className="font-normal text-neutral-400">
                    (optional)
                  </span>
                </label>
                <span className="text-[11px] tabular-nums text-neutral-400">
                  {bio.length}/280
                </span>
              </div>
              <textarea
                id="bio"
                value={bio}
                maxLength={280}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[14px] text-neutral-900 outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/[0.06]"
                placeholder="Classes you teach or preferred cart notes"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-4 px-5 py-6 sm:px-7">
          <div>
            <h3 className="text-[13px] font-semibold tracking-tight text-neutral-950">
              Email updates
            </h3>
            <p className="mt-0.5 text-[13px] text-neutral-500">
              Stay informed without digging through the board.
            </p>
          </div>

          <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-150 border-neutral-100">
            <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-neutral-900">
                  Booking reminders
                </p>
                <p className="text-[12.5px] text-neutral-500">
                  Upcoming cart bookings and cancellations
                </p>
              </div>
              <Switch
                checked={notifyEmail}
                onCheckedChange={setNotifyEmail}
                aria-label="Booking reminders"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-neutral-900">
                  Issue updates
                </p>
                <p className="text-[12.5px] text-neutral-500">
                  When carts you reported are fixed or reopened
                </p>
              </div>
              <Switch
                checked={notifyIssues}
                onCheckedChange={setNotifyIssues}
                aria-label="Issue updates"
              />
            </label>
          </div>
        </div>

        {/* Quiet account note */}
        <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 sm:px-7">
          <p className="text-[12.5px] leading-relaxed text-neutral-500">
            School email and {roleLabel.toLowerCase()} access are managed by IT
            via Google sign-in. Contact IT if your role or email needs to
            change.
          </p>
        </div>
      </div>

      {/* Sticky save — always reachable */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p
            role="status"
            className={cn(
              "min-h-[1.25rem] text-[13px]",
              status?.type === "error"
                ? "text-red-600"
                : status?.type === "ok"
                  ? "text-neutral-600"
                  : dirty
                    ? "text-neutral-500"
                    : "text-neutral-400",
            )}
          >
            {status?.message ??
              (dirty ? "Unsaved changes" : "All changes saved")}
          </p>
          <button
            type="submit"
            disabled={pending || uploading || !name.trim() || !dirty}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full bg-neutral-950 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : null}
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
