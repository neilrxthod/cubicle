"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Loader2 } from "lucide-react";
import { TeacherMobileNav } from "@/components/app/teacher-mobile-nav";
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
import { LocalEmailTestingSection } from "@/components/settings/local-email-testing";
import { SetupPreferences } from "@/components/settings/setup-preferences";
import { deleteAccountAction, signOutAction, updateProfile } from "@/lib/actions";
import { getUiPreferences, setUiPreferences } from "@/lib/preferences/ui";
import { fileToAvatarDataUrl } from "@/lib/profile/image";
import { isVerifiedStaff } from "@/lib/staff/employment";
import type { SessionUser } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const NAME_MAX = 80;

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0]?.slice(0, 2) ?? "U");
  return letters.toUpperCase();
}

export function TeacherMobileSettings({
  user,
  onBack,
  embedded = false,
}: {
  user: SessionUser;
  onBack: () => void;
  embedded?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const deleteRef = useRef<HTMLInputElement>(null);

  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(user.name);
  const [editingName, setEditingName] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [notifyEmail, setNotifyEmail] = useState(user.notifyEmail ?? true);
  const [notifyIssues, setNotifyIssues] = useState(user.notifyIssues ?? true);
  const [allowIssueDelete, setAllowIssueDelete] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const verified = isVerifiedStaff(user);
  const roleLabel = user.role === "admin" ? "Admin" : "Teacher";
  const displayName = name.trim() || user.name;
  const busy = pending || uploading || deleting;
  const canDelete =
    deleteConfirm.trim().toLowerCase() === user.email.toLowerCase();

  useEffect(() => {
    setAllowIssueDelete(getUiPreferences().allowIssueDelete === true);
  }, []);

  useEffect(() => {
    if (!editingName) return;
    nameRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    if (editingName) return;
    setName(user.name);
    setAvatarUrl(user.avatarUrl);
    setNotifyEmail(user.notifyEmail ?? true);
    setNotifyIssues(user.notifyIssues ?? true);
  }, [user, editingName]);

  function payload() {
    return {
      title: user.title,
      department: user.department,
      ...(user.phone ? { phone: user.phone } : {}),
      bio: user.bio,
      notifyEmail: user.notifyEmail ?? true,
      notifyIssues: user.notifyIssues ?? true,
    };
  }

  function save(next: Parameters<typeof updateProfile>[0], onFail?: () => void) {
    startTransition(async () => {
      const res = await updateProfile(next);
      if (!res.ok) {
        onFail?.();
        toast({
          title: "Could not save",
          description: res.error,
          variant: "destructive",
        });
      }
    });
  }

  async function onPickPhoto(file: File | null) {
    if (!file || busy) return;
    const previous = avatarUrl;
    setUploading(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarUrl(dataUrl);
      const res = await updateProfile({
        name: user.name,
        ...payload(),
        avatarUrl: dataUrl,
      });
      if (!res.ok) {
        setAvatarUrl(previous);
        toast({
          title: "Could not save photo",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      setAvatarUrl(res.data?.avatarUrl);
    } catch (error) {
      setAvatarUrl(previous);
      toast({
        title: "Could not use that image",
        description:
          error instanceof Error ? error.message : "Try another photo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePhoto() {
    if (busy || !avatarUrl) return;
    const previous = avatarUrl;
    setAvatarUrl(undefined);
    save(
      { name: user.name, ...payload(), avatarUrl: null },
      () => setAvatarUrl(previous),
    );
  }

  function commitName() {
    const next = name.trim().slice(0, NAME_MAX);
    setEditingName(false);
    if (!next) {
      setName(user.name);
      return;
    }
    if (next === user.name.trim()) {
      setName(next);
      return;
    }
    setName(next);
    save({ name: next, ...payload() }, () => setName(user.name));
  }

  function persistNotify(
    nextEmail: boolean,
    nextIssues: boolean,
  ) {
    setNotifyEmail(nextEmail);
    setNotifyIssues(nextIssues);
    save(
      {
        name: user.name,
        ...payload(),
        notifyEmail: nextEmail,
        notifyIssues: nextIssues,
      },
      () => {
        setNotifyEmail(user.notifyEmail ?? true);
        setNotifyIssues(user.notifyIssues ?? true);
      },
    );
  }

  function handleDelete() {
    if (!canDelete) {
      setDeleteError("Type your email exactly to confirm.");
      return;
    }
    setDeleteError(null);
    startDelete(async () => {
      const res = await deleteAccountAction();
      if (!res.ok) {
        setDeleteError(res.error || "Could not delete account.");
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top,0px)]">
      {embedded ? (
        <header className="flex items-end justify-between gap-3 px-5 pb-1 pt-5">
          <h1 className="text-[34px] font-semibold tracking-[-0.04em] text-neutral-950">
            You
          </h1>
          <button
            type="button"
            disabled={busy}
            onClick={() => void signOutAction()}
            className="pb-1 text-[15px] font-medium tracking-[-0.02em] text-red-600 disabled:opacity-40"
          >
            Sign Out
          </button>
        </header>
      ) : (
        <TeacherMobileNav
          title="Profile"
          onBack={onBack}
          trailing={
            <button
              type="button"
              disabled={busy}
              onClick={() => void signOutAction()}
              className="px-3 py-1 text-[17px] font-medium tracking-[-0.02em] text-red-600 disabled:opacity-40"
            >
              Sign Out
            </button>
          }
        />
      )}

      <main className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 pb-10 pt-2">
        <section className="flex flex-col items-center pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="relative"
            aria-label="Change photo"
          >
            <Avatar className="size-24 ring-1 ring-black/[0.06]">
              {avatarUrl ? (
                <AvatarImage
                  src={avatarUrl}
                  alt=""
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <AvatarFallback className="bg-neutral-900 text-[22px] font-medium tracking-tight text-white">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full bg-neutral-950 text-white ring-2 ring-[#f2f2f7]">
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Camera className="size-3.5" strokeWidth={2} />
              )}
            </span>
          </button>
          <input
            ref={fileRef}
            id="profile-photo"
            name="photo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => onPickPhoto(event.target.files?.[0] ?? null)}
          />

          <div className="mt-3 flex items-center gap-1">
            <p className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
              {displayName}
            </p>
            {verified ? <VerifiedBadge size="sm" /> : null}
          </div>
          <p className="mt-0.5 text-[15px] text-neutral-400">{roleLabel}</p>
        </section>

        <Group>
          {editingName ? (
            <div className="px-4 py-2.5">
              <p className="text-[12px] text-neutral-400">Name</p>
              <input
                ref={nameRef}
                id="profile-name"
                name="name"
                value={name}
                maxLength={NAME_MAX}
                disabled={busy}
                autoComplete="name"
                aria-label="Display name"
                onChange={(event) =>
                  setName(event.target.value.slice(0, NAME_MAX))
                }
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitName();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setName(user.name);
                    setEditingName(false);
                  }
                }}
                className="h-8 w-full bg-transparent text-[17px] tracking-[-0.02em] text-neutral-950 outline-none"
              />
            </div>
          ) : (
            <Row
              label="Name"
              value={displayName}
              onClick={() => setEditingName(true)}
            />
          )}
          <Hairline />
          <Row
            label="Photo"
            value={avatarUrl ? "Change" : "Add"}
            onClick={() => fileRef.current?.click()}
          />
          {avatarUrl ? (
            <>
              <Hairline />
              <button
                type="button"
                disabled={busy}
                onClick={removePhoto}
                className="flex h-[2.75rem] w-full items-center px-4 text-[17px] text-red-600 active:bg-neutral-50 disabled:opacity-40"
              >
                Remove Photo
              </button>
            </>
          ) : null}
        </Group>

        <Labeled title="Notifications">
          <Group>
            <Toggle
              label="Account Email"
              checked={notifyEmail}
              disabled={busy}
              onChange={(checked) => persistNotify(checked, notifyIssues)}
            />
            <Hairline />
            <Toggle
              label="Issue Email"
              checked={notifyIssues}
              disabled={busy}
              onChange={(checked) => persistNotify(notifyEmail, checked)}
            />
          </Group>
        </Labeled>

        <Labeled title="Issues">
          <Group>
            <Toggle
              label="Allow Deleting"
              checked={allowIssueDelete}
              onChange={(checked) => {
                setAllowIssueDelete(checked);
                setUiPreferences({ allowIssueDelete: checked });
              }}
            />
          </Group>
        </Labeled>

        <Labeled title="Account">
          <Group>
            <Meta label="Email" value={user.email} />
            <Hairline />
            <Meta label="Role" value={roleLabel} />
            <Hairline />
            <Meta
              label="Verified"
              value={verified ? "Yes" : "No"}
              trailing={verified ? <VerifiedBadge size="xs" /> : null}
            />
          </Group>
        </Labeled>

        <SetupPreferences user={user} />
        <LocalEmailTestingSection />

        <Group>
          <button
            type="button"
            disabled={busy}
            onClick={() => void signOutAction()}
            className="flex h-[2.75rem] w-full items-center justify-center text-[17px] text-red-600 active:bg-neutral-50 disabled:opacity-40"
          >
            Sign Out
          </button>
        </Group>

        <Group>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDeleteConfirm("");
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="flex h-[2.75rem] w-full items-center justify-center text-[17px] text-red-600 active:bg-neutral-50 disabled:opacity-40"
          >
            Delete Account
          </button>
        </Group>
      </main>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deleting) return;
          setDeleteOpen(open);
          if (!open) {
            setDeleteConfirm("");
            setDeleteError(null);
          } else {
            requestAnimationFrame(() => deleteRef.current?.focus());
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-0 sm:max-w-[400px]">
          <DialogHeader className="space-y-0 px-5 pb-3 pt-5 text-left">
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.02em]">
              Delete Account
            </DialogTitle>
            <DialogDescription className="mt-1 text-[13px] leading-relaxed text-neutral-500">
              This permanently closes your Cubicle account. Type your email to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 pb-5">
            <input
              ref={deleteRef}
              id="delete-account-email"
              name="delete-confirm-email"
              type="email"
              value={deleteConfirm}
              disabled={deleting}
              placeholder={user.email}
              autoComplete="off"
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
                setDeleteError(null);
              }}
              className="h-11 rounded-[12px] border border-neutral-200 bg-[#fafafa] px-3 text-[17px] outline-none focus:border-neutral-400"
            />
            {deleteError ? (
              <p className="text-[13px] text-red-600">{deleteError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <DialogCancel disabled={deleting} onClick={() => setDeleteOpen(false)}>
                Cancel
              </DialogCancel>
              <button
                type="button"
                disabled={deleting || !canDelete}
                onClick={handleDelete}
                className="inline-flex h-9 items-center rounded-md bg-red-600 px-3.5 text-[15px] font-medium text-white disabled:opacity-35"
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[12px] bg-white">{children}</div>
  );
}

function Labeled({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Hairline() {
  return <div className="ml-4 h-px bg-neutral-100" />;
}

function Row({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[2.75rem] w-full items-center gap-3 px-4 text-left active:bg-neutral-50"
    >
      <span className="min-w-0 flex-1 text-[17px] tracking-[-0.02em] text-neutral-950">
        {label}
      </span>
      {value ? (
        <span className="max-w-[50%] truncate text-[17px] text-neutral-400">
          {value}
        </span>
      ) : null}
    </button>
  );
}

function Meta({
  label,
  value,
  trailing,
}: {
  label: string;
  value: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex h-[2.75rem] items-center gap-3 px-4">
      <span className="text-[17px] tracking-[-0.02em] text-neutral-950">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-right text-[17px] text-neutral-400">
        {value}
      </span>
      {trailing}
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex h-[2.75rem] items-center justify-between gap-4 px-4">
      <span className="text-[17px] tracking-[-0.02em] text-neutral-950">
        {label}
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}
