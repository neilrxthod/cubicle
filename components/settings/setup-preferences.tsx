"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { updateBookingPolicy } from "@/lib/actions";
import { usePlatformStore } from "@/lib/data/platform-store";
import {
  conflictingPeriodsForAssignment,
  filterSubjectSuggestions,
  getOnboarding,
  GRADES,
  hasPeriodConflicts,
  isAssignmentComplete,
  newTeachingAssignment,
  periodsFromAssignments,
  saveOnboardingPrefs,
  type Grade,
  type TeachingAssignment,
} from "@/lib/onboarding/storage";
import {
  DEFAULT_MAX_SLOTS_PER_TEACHER_PER_DAY,
  MAX_SLOTS_PER_TEACHER_PER_DAY,
  PERIODS,
  type Period,
  type SessionUser,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  SettingsDivider,
  SettingsRow,
  SettingsSection,
  settingsInputClass,
} from "@/components/settings/settings-section";

const ADVANCE_PRESETS = [7, 14, 21, 30] as const;

function Chip({
  selected,
  onClick,
  children,
  warn,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-[12.5px] font-medium transition-colors",
        selected && !warn && "bg-neutral-950 text-white",
        selected && warn && "bg-amber-600 text-white",
        !selected &&
          "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Corporate Settings editors for first-run onboarding data.
 * Production: edit anytime without reopening the wizard.
 */
export function SetupPreferences({ user }: { user: SessionUser }) {
  if (user.role === "admin") {
    return <AdminBookingWindow user={user} />;
  }
  return <TeacherSchedule user={user} />;
}

function clampDays(n: number) {
  return Math.min(60, Math.max(1, Math.round(n)));
}

function clampSlots(n: number) {
  return Math.min(
    MAX_SLOTS_PER_TEACHER_PER_DAY,
    Math.max(1, Math.round(n)),
  );
}

function AdminBookingWindow({ user }: { user: SessionUser }) {
  const platform = usePlatformStore();
  const stored = getOnboarding(user.id, user.email);
  const platformDays = platform.bookingPolicy.maxAdvanceDays ?? 14;
  const platformSlots = clampSlots(
    platform.bookingPolicy.maxSlotsPerTeacherPerDay ??
      DEFAULT_MAX_SLOTS_PER_TEACHER_PER_DAY,
  );

  // Local baselines so Save / dirty state stay stable (not racing remote refresh).
  const [savedDays, setSavedDays] = useState(() =>
    clampDays(stored.maxAdvanceDays ?? platformDays),
  );
  const [savedSlots, setSavedSlots] = useState(() => platformSlots);
  const [days, setDays] = useState(savedDays);
  const [slots, setSlots] = useState(savedSlots);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    type: "ok" | "error";
    message: string;
  } | null>(null);

  const dirty = days !== savedDays || slots !== savedSlots;

  function handleSave() {
    const nextDays = clampDays(days);
    const nextSlots = clampSlots(slots);
    setDays(nextDays);
    setSlots(nextSlots);
    setStatus(null);
    startTransition(async () => {
      const res = await updateBookingPolicy({
        maxAdvanceDays: nextDays,
        maxSlotsPerTeacherPerDay: nextSlots,
      });
      if (!res.ok) {
        setStatus({
          type: "error",
          message: res.error || "Could not save booking policy.",
        });
        return;
      }
      saveOnboardingPrefs(
        user.id || user.email,
        { maxAdvanceDays: nextDays },
        [user.id, user.email],
      );
      setSavedDays(nextDays);
      setSavedSlots(nextSlots);
      setDays(nextDays);
      setSlots(nextSlots);
      setStatus({ type: "ok", message: "Saved" });
    });
  }

  return (
    <SettingsSection id="setup" title="Booking policy">
      <SettingsRow className="space-y-4">
        <p className="text-[12.5px] leading-snug text-neutral-400">
          How far ahead teachers can book carts.
        </p>

        <div className="flex items-center justify-center gap-4 py-1">
          <button
            type="button"
            onClick={() => {
              setDays((d) => clampDays(d - 1));
              setStatus(null);
            }}
            disabled={days <= 1 || pending}
            aria-label="Fewer days"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 transition",
              "hover:bg-white disabled:opacity-30",
            )}
          >
            <Minus className="size-3.5" strokeWidth={2} />
          </button>
          <div className="min-w-[5.5rem] text-center tabular-nums">
            <p className="text-[2.25rem] font-extralight leading-none tracking-[-0.04em] text-neutral-950">
              {days}
            </p>
            <p className="mt-1 text-[12px] text-neutral-400">
              {days === 1 ? "day ahead" : "days ahead"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDays((d) => clampDays(d + 1));
              setStatus(null);
            }}
            disabled={days >= 60 || pending}
            aria-label="More days"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 transition",
              "hover:bg-white disabled:opacity-30",
            )}
          >
            <Plus className="size-3.5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {ADVANCE_PRESETS.map((preset) => {
            const active = days === preset;
            return (
              <button
                key={preset}
                type="button"
                disabled={pending}
                onClick={() => {
                  setDays(preset);
                  setStatus(null);
                }}
                className={cn(
                  "h-8 min-w-[2.75rem] rounded-full px-3 text-[12.5px] font-medium tabular-nums transition-colors",
                  active
                    ? "bg-neutral-950 text-white"
                    : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900",
                )}
              >
                {preset}d
              </button>
            );
          })}
        </div>
      </SettingsRow>

      <SettingsDivider />

      <SettingsRow className="space-y-4">
        <div>
          <p className="text-[13px] font-medium tracking-[-0.01em] text-neutral-900">
            Max cart slots per day
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-neutral-400">
            Cap how many cart periods a teacher can book on one school day
            (1–{MAX_SLOTS_PER_TEACHER_PER_DAY}). Teachers still get at most one
            cart per period.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 py-1">
          <button
            type="button"
            onClick={() => {
              setSlots((s) => clampSlots(s - 1));
              setStatus(null);
            }}
            disabled={slots <= 1 || pending}
            aria-label="Fewer slots"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 transition",
              "hover:bg-white disabled:opacity-30",
            )}
          >
            <Minus className="size-3.5" strokeWidth={2} />
          </button>
          <div className="min-w-[5.5rem] text-center tabular-nums">
            <p className="text-[2.25rem] font-extralight leading-none tracking-[-0.04em] text-neutral-950">
              {slots}
            </p>
            <p className="mt-1 text-[12px] text-neutral-400">
              {slots === 1 ? "slot / day" : "slots / day"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSlots((s) => clampSlots(s + 1));
              setStatus(null);
            }}
            disabled={slots >= MAX_SLOTS_PER_TEACHER_PER_DAY || pending}
            aria-label="More slots"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 transition",
              "hover:bg-white disabled:opacity-30",
            )}
          >
            <Plus className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </SettingsRow>

      <SettingsDivider />

      <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "min-h-[1.25rem] min-w-0 flex-1 truncate text-[12px] leading-5",
            status?.type === "error"
              ? "text-red-600"
              : status?.type === "ok"
                ? "text-neutral-500"
                : "text-neutral-400",
          )}
        >
          {status?.message ?? (dirty ? "Unsaved changes" : "Up to date")}
        </p>
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={handleSave}
          className={cn(
            "inline-flex h-8 w-[7.25rem] shrink-0 items-center justify-center gap-1.5 rounded-full",
            "bg-neutral-950 text-[12.5px] font-medium text-white",
            "transition-opacity hover:opacity-90 disabled:opacity-30",
          )}
        >
          <span className="inline-flex size-3 shrink-0 items-center justify-center">
            {pending ? (
              <Loader2 className="size-3 animate-spin" strokeWidth={2} />
            ) : null}
          </span>
          Save policy
        </button>
      </div>
    </SettingsSection>
  );
}

function TeacherSchedule({ user }: { user: SessionUser }) {
  const prefs = getOnboarding(user.id, user.email);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>(() => {
    const existing = prefs.teachingAssignments?.filter(Boolean) ?? [];
    return existing.length > 0 ? existing : [newTeachingAssignment()];
  });
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    type: "ok" | "error";
    message: string;
  } | null>(null);

  const [savedKey, setSavedKey] = useState(() =>
    JSON.stringify(prefs.teachingAssignments ?? []),
  );
  const isDirty = JSON.stringify(assignments) !== savedKey;

  const valid = useMemo(
    () => assignments.filter(isAssignmentComplete),
    [assignments],
  );
  const teachingOk =
    valid.length > 0 &&
    assignments.every((a) => {
      const empty =
        !a.subject.trim() && a.grades.length === 0 && a.periods.length === 0;
      return empty || isAssignmentComplete(a);
    });
  const periodConflict = hasPeriodConflicts(assignments);

  function updateAt(id: string, next: TeachingAssignment) {
    setAssignments((list) => list.map((a) => (a.id === id ? next : a)));
    setStatus(null);
  }

  function handleSave() {
    setStatus(null);
    if (!teachingOk) {
      setStatus({
        type: "error",
        message: "Add at least one complete subject.",
      });
      return;
    }
    if (periodConflict) {
      setStatus({
        type: "error",
        message: "Each period can only be on one subject.",
      });
      return;
    }
    startTransition(() => {
      const cleaned = assignments
        .filter(isAssignmentComplete)
        .map((a) => ({ ...a, subject: a.subject.trim() }));
      saveOnboardingPrefs(
        user.id || user.email,
        {
          teachingAssignments: cleaned,
          preferredPeriods: periodsFromAssignments(cleaned),
          department: cleaned[0]?.subject || prefs.department,
        },
        [user.id, user.email],
      );
      setSavedKey(JSON.stringify(cleaned));
      setAssignments(cleaned);
      setStatus({ type: "ok", message: "Teaching schedule saved" });
    });
  }

  return (
    <SettingsSection id="setup" title="Teaching schedule">
      <SettingsRow className="space-y-1 pb-2">
        <p className="text-[12.5px] leading-snug text-neutral-400">
          Subjects, grades, and periods used when booking. First set at setup;
          update here anytime.
        </p>
      </SettingsRow>

      {assignments.map((assignment, index) => {
        const conflicts = conflictingPeriodsForAssignment(
          assignments,
          assignment.id,
        );
        return (
          <div key={assignment.id}>
            {index > 0 ? <SettingsDivider /> : null}
            <AssignmentEditor
              assignment={assignment}
              index={index}
              canRemove={assignments.length > 1}
              conflicts={conflicts}
              onChange={(next) => updateAt(assignment.id, next)}
              onRemove={() => {
                setAssignments((list) =>
                  list.filter((a) => a.id !== assignment.id),
                );
                setStatus(null);
              }}
            />
          </div>
        );
      })}

      <SettingsDivider />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setAssignments((list) => [...list, newTeachingAssignment()]);
            setStatus(null);
          }}
          className="text-[12.5px] font-medium text-neutral-600 transition-colors hover:text-neutral-950 disabled:opacity-40"
        >
          Add subject
        </button>
        <div className="flex items-center gap-3">
          <p
            role="status"
            className={cn(
              "text-[12px]",
              status?.type === "error"
                ? "text-red-600"
                : status?.type === "ok"
                  ? "text-neutral-500"
                  : "text-neutral-400",
            )}
          >
            {status?.message ??
              (periodConflict
                ? "Period conflict"
                : isDirty
                  ? "Unsaved changes"
                  : "Up to date")}
          </p>
          <button
            type="button"
            disabled={!isDirty || pending || !teachingOk}
            onClick={handleSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-neutral-950 px-3.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" strokeWidth={2} />
            ) : null}
            Save schedule
          </button>
        </div>
      </div>
    </SettingsSection>
  );
}

function AssignmentEditor({
  assignment,
  index,
  canRemove,
  conflicts,
  onChange,
  onRemove,
}: {
  assignment: TeachingAssignment;
  index: number;
  canRemove: boolean;
  conflicts: Period[];
  onChange: (next: TeachingAssignment) => void;
  onRemove: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(
    () => filterSubjectSuggestions(assignment.subject, 6),
    [assignment.subject],
  );
  const showSuggestions =
    focused &&
    suggestions.length > 0 &&
    !suggestions.some(
      (s) => s.toLowerCase() === assignment.subject.trim().toLowerCase(),
    );

  function toggleGrade(g: Grade) {
    const grades = assignment.grades.includes(g)
      ? assignment.grades.filter((x) => x !== g)
      : [...assignment.grades, g].sort((a, b) => a - b);
    onChange({ ...assignment, grades });
  }

  function togglePeriod(p: Period) {
    const periods = assignment.periods.includes(p)
      ? assignment.periods.filter((x) => x !== p)
      : ([...assignment.periods, p] as Period[]).sort((a, b) =>
          a.localeCompare(b),
        );
    onChange({ ...assignment, periods });
  }

  return (
    <div className="space-y-3.5 px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium tracking-[-0.01em] text-neutral-900">
          {assignment.subject.trim() || `Subject ${index + 1}`}
        </p>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex size-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
            aria-label={`Remove subject ${index + 1}`}
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      <div className="relative">
        <input
          value={assignment.subject}
          onChange={(e) => onChange({ ...assignment, subject: e.target.value })}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 150);
          }}
          placeholder="Subject"
          className={settingsInputClass}
          autoComplete="off"
        />
        {showSuggestions ? (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-20 overflow-hidden rounded-[10px] border border-neutral-200 bg-white py-1 shadow-lg">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="flex w-full px-3 py-2 text-left text-[13px] text-neutral-800 transition hover:bg-neutral-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ ...assignment, subject: s });
                  setFocused(false);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium tracking-[0.08em] text-neutral-400 uppercase">
          Grades
        </p>
        <div className="flex flex-wrap gap-1.5">
          {GRADES.map((g) => (
            <Chip
              key={g}
              selected={assignment.grades.includes(g)}
              onClick={() => toggleGrade(g)}
            >
              {g}
            </Chip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-medium tracking-[0.08em] text-neutral-400 uppercase">
          Periods
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <Chip
              key={p}
              selected={assignment.periods.includes(p)}
              warn={conflicts.includes(p)}
              onClick={() => togglePeriod(p)}
            >
              {p}
            </Chip>
          ))}
        </div>
        {conflicts.length > 0 ? (
          <p className="text-[12px] text-amber-700">
            {conflicts.join(", ")} already on another subject
          </p>
        ) : null}
      </div>
    </div>
  );
}
