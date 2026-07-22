"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2, UserRound } from "lucide-react";
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

const fieldClass =
  "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13.5px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5";

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
        message: "Photo ready — save changes to apply it.",
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
          message: res.error || "Could not save settings.",
        });
        return;
      }
      setAvatarDirty(false);
      setStatus({ type: "ok", message: "Settings saved." });
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Photo */}
      <section className="rounded-xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-950">
          Profile photo
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          Shown in the header and on account menus.
        </p>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="size-20 rounded-full object-cover ring-2 ring-neutral-100"
              />
            ) : (
              <span className="flex size-20 items-center justify-center rounded-full bg-neutral-950 text-[1.25rem] font-semibold text-white">
                {initials(name || user.name)}
              </span>
            )}
            {uploading ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Loader2 className="size-5 animate-spin text-white" />
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
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
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 text-[13px] font-medium text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <Camera className="size-3.5" strokeWidth={1.75} />
              Upload photo
            </button>
            {avatarUrl ? (
              <button
                type="button"
                disabled={uploading || pending}
                onClick={removePhoto}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" strokeWidth={1.75} />
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Identity */}
      <section className="rounded-xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-950">
          Profile details
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          How you appear across bookings and issue reports.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="name" className="text-[12.5px] font-medium text-neutral-600">
              Display name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              placeholder="Your name"
              required
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="email" className="text-[12.5px] font-medium text-neutral-600">
              Email
            </label>
            <input
              id="email"
              value={user.email}
              disabled
              className={cn(fieldClass, "bg-neutral-50 text-neutral-500")}
            />
            <p className="text-[11.5px] text-neutral-400">
              School email is managed by your administrator.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="title" className="text-[12.5px] font-medium text-neutral-600">
              Job title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={fieldClass}
              placeholder="e.g. Science Teacher"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="department"
              className="text-[12.5px] font-medium text-neutral-600"
            >
              Department
            </label>
            <input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={fieldClass}
              placeholder="e.g. Science"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="phone" className="text-[12.5px] font-medium text-neutral-600">
              Phone
            </label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={fieldClass}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="bio" className="text-[12.5px] font-medium text-neutral-600">
                Bio
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
              rows={3}
              className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[13.5px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-900/5"
              placeholder="A short note about your classes or role."
            />
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="rounded-xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-950">
          Notifications
        </h2>
        <p className="mt-1 text-[13px] text-neutral-500">
          Choose what Cubicle can email you about.
        </p>

        <div className="mt-4 divide-y divide-neutral-100 rounded-xl border border-neutral-100">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-neutral-900">
                Booking reminders
              </p>
              <p className="text-[12.5px] text-neutral-500">
                Upcoming cart reservations and cancellations.
              </p>
            </div>
            <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-neutral-900">
                Issue updates
              </p>
              <p className="text-[12.5px] text-neutral-500">
                When issues you reported are resolved or reopened.
              </p>
            </div>
            <Switch checked={notifyIssues} onCheckedChange={setNotifyIssues} />
          </div>
        </div>
      </section>

      {/* Account meta */}
      <section className="rounded-xl border border-neutral-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
            <UserRound className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-neutral-950">
              Account
            </h2>
            <p className="mt-1 text-[13px] text-neutral-500">
              Signed in as{" "}
              <span className="font-medium capitalize text-neutral-800">
                {user.role}
              </span>
              . Role and email are managed by school IT.
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col items-stretch gap-3 pb-2 sm:flex-row sm:items-center sm:justify-end">
        {status ? (
          <p
            role="status"
            className={cn(
              "text-[13px] sm:mr-auto",
              status.type === "ok" ? "text-neutral-600" : "text-red-600",
            )}
          >
            {status.message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || uploading || !name.trim()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-neutral-950 px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {pending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
