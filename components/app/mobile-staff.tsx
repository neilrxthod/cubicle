"use client";

import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { TeacherMobileNav } from "@/components/app/teacher-mobile-nav";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { PresenceDot } from "@/components/presence-dot";
import { VerifiedBadge } from "@/components/verified-badge";
import {
  createTeacherCredentials,
  deleteTeacherCredentials,
  updateTeacherCredentials,
} from "@/lib/actions";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/auth/school-domain";
import { getSchoolDate } from "@/lib/calendar/period-schedule";
import { usePlatformStore } from "@/lib/data/platform-store";
import { splitDisplayName } from "@/lib/profile/display-name";
import {
  EMPLOYMENT_TYPES,
  employmentLabel,
  isVerifiedStaff,
} from "@/lib/staff/employment";
import { usePresenceMap } from "@/lib/staff/presence";
import { toast } from "@/hooks/use-toast";
import type { EmploymentType, Role, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type FilterId = "all" | "pending" | "verified" | "revoked";
type Sheet =
  | { mode: "profile"; userId: string }
  | { mode: "add" }
  | { mode: "edit"; userId: string };

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0]?.slice(0, 2) ?? "?");
  return letters.toUpperCase();
}

function slugEmailToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function emailLocalFromNames(firstName: string, lastName: string) {
  const first = slugEmailToken(firstName);
  const last = slugEmailToken(lastName);
  if (first && last) return `${first}.${last}`;
  return first || last || "";
}

function schoolEmailLocalPart(email: string) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  return at === -1 ? normalized : normalized.slice(0, at);
}

function composeSchoolEmail(localOrFull: string) {
  const local = schoolEmailLocalPart(localOrFull)
    .replace(/[^a-z0-9._+-]/gi, "")
    .replace(/^\.+|\.+$/g, "");
  return `${local}@${SCHOOL_EMAIL_DOMAIN}`;
}

function accessLabel(user: User) {
  if (user.allowlisted === false) return "Revoked";
  if (user.pendingInvite) return "Pending";
  return user.role === "admin" ? "Admin" : "Teacher";
}

export function MobileStaff({ onBack }: { onBack: () => void }) {
  const { users, bookings, issues } = usePlatformStore();
  const presence = usePresenceMap();
  const today = getSchoolDate();
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const counts = useMemo(() => {
    let all = 0;
    let pending = 0;
    let verified = 0;
    let revoked = 0;
    for (const user of users) {
      if (user.allowlisted === false) {
        revoked += 1;
        continue;
      }
      all += 1;
      if (user.pendingInvite) pending += 1;
      if (isVerifiedStaff(user)) verified += 1;
    }
    return { all, pending, verified, revoked };
  }, [users]);

  const metrics = useMemo(() => {
    const map = new Map<string, { upcoming: number; openIssues: number }>();
    for (const user of users) {
      const nameKey = user.name.trim().toLowerCase();
      const upcoming = bookings.filter(
        (booking) =>
          booking.date >= today &&
          (booking.teacherId === user.id ||
            booking.teacherName.trim().toLowerCase() === nameKey),
      ).length;
      const openIssues = issues.filter(
        (issue) =>
          issue.status === "open" &&
          (issue.reportedById === user.id ||
            issue.reporterName.toLowerCase() === nameKey),
      ).length;
      map.set(user.id, { upcoming, openIssues });
    }
    return map;
  }, [users, bookings, issues, today]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users
      .filter((user) => {
        if (filter === "pending") {
          if (!user.pendingInvite || user.allowlisted === false) return false;
        } else if (filter === "verified") {
          if (!isVerifiedStaff(user)) return false;
        } else if (filter === "revoked") {
          if (user.allowlisted !== false) return false;
        } else if (user.allowlisted === false) {
          return false;
        }
        if (!term) return true;
        return [user.name, user.email, user.role, user.title, user.department]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, filter, query]);

  const selected =
    sheet && sheet.mode !== "add"
      ? (users.find((user) => user.id === sheet.userId) ?? null)
      : null;

  const empty =
    filter === "pending"
      ? "No pending invites"
      : filter === "verified"
        ? "No verified staff"
        : filter === "revoked"
          ? "No revoked accounts"
          : "No staff";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top,0px)]">
      <TeacherMobileNav
        title="Staff"
        onBack={onBack}
        trailing={
          <button
            type="button"
            onClick={() => setSheet({ mode: "add" })}
            className="px-3 py-1 text-[17px] font-medium tracking-[-0.02em] text-[#007aff]"
          >
            Add
          </button>
        }
      />

      <div className="shrink-0 px-5 pb-2 pt-1">
        <div
          role="tablist"
          aria-label="Staff filter"
          className="grid grid-cols-4 rounded-[9px] bg-black/[0.06] p-0.5"
        >
          {(
            [
              { id: "all", label: "All", count: counts.all },
              { id: "pending", label: "Pending", count: counts.pending },
              { id: "verified", label: "Verified", count: counts.verified },
              { id: "revoked", label: "Revoked", count: counts.revoked },
            ] as const
          ).map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "h-[30px] rounded-[7px] text-[12px] font-medium tracking-[-0.01em]",
                  active
                    ? "bg-white text-neutral-950 shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                    : "text-neutral-500",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <label className="mt-3 flex h-9 items-center gap-2 rounded-[10px] bg-black/[0.06] px-2.5">
          <Search className="size-4 text-neutral-400" strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-full min-w-0 flex-1 bg-transparent text-[17px] tracking-[-0.02em] text-neutral-950 outline-none placeholder:text-neutral-400"
          />
        </label>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 pt-16 text-center">
            <p className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
              {empty}
            </p>
            <p className="mt-1 text-[15px] leading-snug text-neutral-400">
              Add school accounts so staff can sign in.
            </p>
          </div>
        ) : (
          <section>
            <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-[-0.01em] text-neutral-500">
              Directory
            </h2>
            <ul className="overflow-hidden rounded-[12px] bg-white">
              {visible.map((user, index) => {
                const status = presence.get(user.id) ?? "offline";
                const verified = isVerifiedStaff(user);
                return (
                  <li
                    key={user.id}
                    className={index > 0 ? "border-t border-neutral-100" : undefined}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSheet({ mode: "profile", userId: user.id })
                      }
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-neutral-50"
                    >
                      <span className="relative shrink-0">
                        <Avatar className="size-10">
                          {user.avatarUrl ? (
                            <AvatarImage
                              src={user.avatarUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                          <AvatarFallback className="bg-neutral-200 text-[12px] font-medium text-neutral-600">
                            {initials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <PresenceDot status={status} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1">
                          <span className="truncate text-[17px] tracking-[-0.02em] text-neutral-950">
                            {user.name}
                          </span>
                          {verified ? <VerifiedBadge size="xs" /> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-neutral-400">
                          {user.email}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[13px]",
                          user.allowlisted === false
                            ? "text-red-600"
                            : user.pendingInvite
                              ? "text-orange-500"
                              : "text-neutral-400",
                        )}
                      >
                        {accessLabel(user)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      {sheet?.mode === "profile" && selected ? (
        <StaffSheet
          user={selected}
          upcoming={metrics.get(selected.id)?.upcoming ?? 0}
          openIssues={metrics.get(selected.id)?.openIssues ?? 0}
          onClose={() => setSheet(null)}
          onEdit={() => setSheet({ mode: "edit", userId: selected.id })}
        />
      ) : null}

      {sheet?.mode === "add" || (sheet?.mode === "edit" && selected) ? (
        <StaffFormSheet
          user={sheet.mode === "edit" ? selected : null}
          onClose={() =>
            sheet.mode === "edit" && selected
              ? setSheet({ mode: "profile", userId: selected.id })
              : setSheet(null)
          }
        />
      ) : null}
    </div>
  );
}

function StaffSheet({
  user,
  upcoming,
  openIssues,
  onClose,
  onEdit,
}: {
  user: User;
  upcoming: number;
  openIssues: number;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [pending, startTransition] = useTransition();
  const revoked = user.allowlisted === false;

  function handleRemove() {
    startTransition(async () => {
      const res = await deleteTeacherCredentials(user.id);
      if (!res.ok) {
        toast({
          title: "Could not remove staff",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Access removed", description: user.name });
      onClose();
    });
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(user.email);
      toast({ title: "Email copied" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  }

  return (
    <div className="absolute inset-0 z-30">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[92%] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex max-h-full flex-col overflow-hidden rounded-[14px] bg-[#f2f2f7] shadow-[0_-8px_40px_rgba(0,0,0,0.18)]">
          <div className="flex justify-center pt-2">
            <span className="h-1 w-10 rounded-full bg-neutral-300" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col items-center px-5 pb-4 pt-3">
              <Avatar className="size-20">
                {user.avatarUrl ? (
                  <AvatarImage
                    src={user.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <AvatarFallback className="bg-neutral-200 text-[22px] font-medium text-neutral-600">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-3 flex items-center gap-1.5 text-[28px] font-semibold leading-tight tracking-[-0.04em] text-neutral-950">
                <span className="truncate">{user.name}</span>
                {isVerifiedStaff(user) ? <VerifiedBadge size="md" /> : null}
              </h2>
              <button
                type="button"
                onClick={() => void copyEmail()}
                className="mt-1 text-[15px] text-[#007aff]"
              >
                {user.email}
              </button>
            </div>

            <dl className="mx-3 mb-3 overflow-hidden rounded-[12px] bg-white">
              <MetaRow label="Role" value={user.role === "admin" ? "Admin" : "Teacher"} />
              <MetaRow
                label="Employment"
                value={employmentLabel(user.employmentType)}
              />
              <MetaRow label="Access" value={accessLabel(user)} />
              {user.title ? <MetaRow label="Title" value={user.title} /> : null}
              {user.department ? (
                <MetaRow label="Department" value={user.department} />
              ) : null}
              <MetaRow
                label="Upcoming"
                value={`${upcoming} reservation${upcoming === 1 ? "" : "s"}`}
              />
              <MetaRow
                label="Open issues"
                value={String(openIssues)}
              />
            </dl>
          </div>

          <div className="flex flex-col gap-2 px-3 pb-3">
            {!revoked ? (
              <button
                type="button"
                onClick={onEdit}
                className="flex h-12 items-center justify-center rounded-[12px] bg-white text-[17px] font-medium text-[#007aff] active:bg-neutral-50"
              >
                Edit
              </button>
            ) : null}
            {!revoked ? (
              removing ? (
                <div className="grid grid-cols-2 overflow-hidden rounded-[12px] bg-white">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setRemoving(false)}
                    className="h-12 text-[17px] text-[#007aff] active:bg-neutral-50 disabled:opacity-40"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={handleRemove}
                    className="h-12 border-l border-neutral-100 text-[17px] font-semibold text-red-600 active:bg-red-50 disabled:opacity-40"
                  >
                    {pending ? "…" : "Remove"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRemoving(true)}
                  className="flex h-12 items-center justify-center rounded-[12px] bg-white text-[17px] font-medium text-red-600 active:bg-red-50"
                >
                  Remove Access
                </button>
              )
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 items-center justify-center rounded-[12px] bg-white text-[17px] font-semibold text-[#007aff] active:bg-neutral-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffFormSheet({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const names = splitDisplayName(user?.name ?? "");
  const [firstName, setFirstName] = useState(names.firstName ?? "");
  const [lastName, setLastName] = useState(names.lastName ?? "");
  const [emailLocal, setEmailLocal] = useState(
    user ? schoolEmailLocalPart(user.email) : "",
  );
  const [emailTouched, setEmailTouched] = useState(Boolean(user));
  const [role, setRole] = useState<Role>(user?.role ?? "teacher");
  const [employment, setEmployment] = useState<EmploymentType>(
    user?.employmentType ?? "permanent",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function syncEmail(nextFirst: string, nextLast: string) {
    if (emailTouched) return;
    setEmailLocal(emailLocalFromNames(nextFirst, nextLast));
  }

  function handleSave() {
    const name = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const email = composeSchoolEmail(
      emailLocal || emailLocalFromNames(firstName, lastName),
    );
    const formData = new FormData();
    formData.set("name", name);
    formData.set("email", email);
    formData.set("role", role);
    formData.set("employmentType", employment);

    startTransition(async () => {
      setError(null);
      const res = user
        ? await updateTeacherCredentials(user.id, formData)
        : await createTeacherCredentials(formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast({ title: user ? "Staff updated" : "Staff added", description: name });
      onClose();
    });
  }

  return (
    <div className="absolute inset-0 z-40">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[92%] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex max-h-full flex-col overflow-hidden rounded-[14px] bg-[#f2f2f7] shadow-[0_-8px_40px_rgba(0,0,0,0.18)]">
          <div className="flex justify-center pt-2">
            <span className="h-1 w-10 rounded-full bg-neutral-300" />
          </div>
          <div className="px-5 pb-2 pt-3">
            <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-neutral-950">
              {user ? "Edit Staff" : "Add Staff"}
            </h2>
            <p className="mt-1 text-[15px] text-neutral-500">
              School accounts use @{SCHOOL_EMAIL_DOMAIN}.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
            <div className="overflow-hidden rounded-[12px] bg-white">
              <Field
                label="First"
                value={firstName}
                onChange={(value) => {
                  setFirstName(value);
                  syncEmail(value, lastName);
                }}
              />
              <Field
                label="Last"
                value={lastName}
                onChange={(value) => {
                  setLastName(value);
                  syncEmail(firstName, value);
                }}
              />
              <label className="flex items-center gap-3 border-t border-neutral-100 px-4 py-2.5">
                <span className="w-16 shrink-0 text-[15px] text-neutral-400">
                  Email
                </span>
                <input
                  value={emailLocal}
                  onChange={(event) => {
                    setEmailTouched(true);
                    setEmailLocal(event.target.value);
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent text-[17px] tracking-[-0.02em] text-neutral-950 outline-none"
                />
                <span className="shrink-0 text-[13px] text-neutral-400">
                  @{SCHOOL_EMAIL_DOMAIN}
                </span>
              </label>
            </div>

            <h3 className="px-1 pb-2 pt-5 text-[13px] font-semibold tracking-[-0.01em] text-neutral-500">
              Role
            </h3>
            <Segmented
              value={role}
              onChange={setRole}
              options={[
                { id: "teacher", label: "Teacher" },
                { id: "admin", label: "Admin" },
              ]}
            />

            <h3 className="px-1 pb-2 pt-5 text-[13px] font-semibold tracking-[-0.01em] text-neutral-500">
              Employment
            </h3>
            <Segmented
              value={employment}
              onChange={setEmployment}
              options={EMPLOYMENT_TYPES.map((item) => ({
                id: item.id,
                label: item.shortLabel,
              }))}
            />

            {error ? (
              <p className="px-1 pt-3 text-[13px] text-red-600">{error}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 px-3 pb-3 pt-2">
            <button
              type="button"
              disabled={pending}
              onClick={handleSave}
              className="flex h-12 items-center justify-center rounded-[12px] bg-white text-[17px] font-semibold text-[#007aff] active:bg-neutral-50 disabled:opacity-40"
            >
              {pending ? "…" : user ? "Save" : "Add Staff"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 items-center justify-center rounded-[12px] bg-white text-[17px] font-medium text-neutral-500 active:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 border-t border-neutral-100 px-4 py-2.5 first:border-t-0">
      <span className="w-16 shrink-0 text-[15px] text-neutral-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-[17px] tracking-[-0.02em] text-neutral-950 outline-none"
      />
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ id: T; label: string }>;
}) {
  return (
    <div className="grid overflow-hidden rounded-[12px] bg-white" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option, index) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "h-11 text-[15px] font-medium",
              index > 0 && "border-l border-neutral-100",
              active ? "text-[#007aff]" : "text-neutral-500",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-neutral-100 px-4 py-2.5 first:border-t-0">
      <dt className="shrink-0 text-[15px] text-neutral-400">{label}</dt>
      <dd className="truncate text-right text-[15px] tracking-[-0.01em] text-neutral-950">
        {value}
      </dd>
    </div>
  );
}
