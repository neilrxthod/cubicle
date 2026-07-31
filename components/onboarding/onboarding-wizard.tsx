"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  GraduationCap,
  Loader2,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { CubicleWordmark } from "@/components/auth/wordmark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from "@/lib/auth/constants";
import {
  completeOnboarding,
  conflictingPeriodsForAssignment,
  filterSubjectSuggestions,
  getOnboardingDraft,
  GRADES,
  hasPeriodConflicts,
  isAssignmentComplete,
  newTeachingAssignment,
  onboardingHomeForRole,
  periodsFromAssignments,
  saveOnboardingDraft,
  type Grade,
  type OnboardingPrefs,
  type TeachingAssignment,
} from "@/lib/onboarding/storage";
import { fileToAvatarDataUrl } from "@/lib/profile/image";
import { PERIODS, type Period, type SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlatformStore, mutate } from "@/lib/data/platform-store";
import { updateProfile } from "@/lib/actions";
import { setSession, getSession } from "@/lib/auth/session";
import { toast } from "@/hooks/use-toast";

/**
 * Simple 2-step setup for cart booking only.
 * 1. You — optional photo
 * 2. Teach / School — classes or booking window → Schedule
 */
type StepId = "welcome" | "setup";

const TEACHER_STEPS: { id: StepId; label: string }[] = [
  { id: "welcome", label: "You" },
  { id: "setup", label: "Teach" },
];

const ADMIN_STEPS: { id: StepId; label: string }[] = [
  { id: "welcome", label: "You" },
  { id: "setup", label: "School" },
];

const stepTransition = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 420, damping: 34 },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.14 },
  },
};

/* ─── Brand panel ────────────────────────────────────────── */

function FeatureLaunchPanel() {
  return (
    <aside
      aria-hidden
      className="relative hidden h-full min-h-0 w-[42%] shrink-0 overflow-hidden md:block"
    >
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 100% 80% at 20% 0%, rgba(255,255,255,0.22) 0%, transparent 55%),
            radial-gradient(ellipse 70% 60% at 100% 30%, rgba(255,255,255,0.08) 0%, transparent 50%),
            radial-gradient(ellipse 80% 70% at 50% 100%, rgba(255,255,255,0.06) 0%, transparent 55%),
            linear-gradient(160deg, #1a1a1a 0%, #0a0a0a 40%, #000000 72%, #111111 100%)
          `,
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.09)_0%,transparent_42%,transparent_58%,rgba(255,255,255,0.04)_100%)]" />
      <motion.div
        className="absolute -top-1/3 left-[-10%] h-[75%] w-[75%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.14)_0%,transparent_65%)] blur-3xl"
        animate={{ x: [0, 28, 0], y: [0, 18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Setup mark — logo-style word only */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-8 text-center">
        <span
          className={cn(
            "inline-block select-none font-extralight uppercase antialiased",
            "text-[clamp(1.65rem,3.6vw,2.35rem)] tracking-[0.48em] leading-none",
            "text-white/95 mr-[-0.48em]",
            "drop-shadow-[0_1px_24px_rgba(255,255,255,0.1)]",
          )}
        >
          Setup
        </span>
      </div>
    </aside>
  );
}

/* ─── Progress: continuous bar (endowed progress feel) ───── */

function ProgressBar({
  currentIndex,
  total,
}: {
  currentIndex: number;
  total: number;
}) {
  // Start partially filled so step 1 already feels “underway”
  const pct = ((currentIndex + 1) / total) * 100;
  return (
    <div className="w-full" aria-label={`Step ${currentIndex + 1} of ${total}`}>
      <div className="h-1 overflow-hidden rounded-full bg-neutral-100">
        <motion.div
          className="h-full rounded-full bg-neutral-950"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
        />
      </div>
    </div>
  );
}

function SelectChip({
  selected,
  onClick,
  children,
  warn,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3.5 text-[13px] font-normal transition-all duration-150 active:scale-[0.96]",
        selected &&
          !warn &&
          "bg-neutral-950 text-white shadow-sm shadow-neutral-950/15",
        selected && warn && "bg-amber-600 text-white shadow-sm",
        !selected &&
          "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900",
      )}
    >
      {children}
    </button>
  );
}

function TeachingLoadBlock({
  assignment,
  index,
  canRemove,
  conflicts,
  onChange,
  onRemove,
  onDuplicate,
}: {
  assignment: TeachingAssignment;
  index: number;
  canRemove: boolean;
  conflicts: Period[];
  onChange: (next: TeachingAssignment) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const complete = isAssignmentComplete(assignment);
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
    <div
      className={cn(
        "relative space-y-3.5 rounded-2xl border p-4 text-left transition-all duration-200",
        complete
          ? "border-emerald-200/80 bg-emerald-50/30 shadow-sm"
          : "border-neutral-200/90 bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-[11px] font-medium transition-colors",
              complete
                ? "bg-emerald-600 text-white"
                : "bg-neutral-100 text-neutral-500",
            )}
          >
            {complete ? (
              <Check className="size-3" strokeWidth={2.5} />
            ) : (
              index + 1
            )}
          </span>
          <p className="text-[13px] font-medium tracking-[-0.01em] text-neutral-900">
            {assignment.subject.trim() || `Subject ${index + 1}`}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          {complete ? (
            <button
              type="button"
              onClick={onDuplicate}
              className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-neutral-500 transition hover:bg-white hover:text-neutral-800"
            >
              + Same grades
            </button>
          ) : null}
          {canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex size-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-white hover:text-neutral-700"
              aria-label={`Remove subject ${index + 1}`}
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Subject first — recognition over recall */}
      <div className="relative">
        <input
          value={assignment.subject}
          onChange={(e) =>
            onChange({ ...assignment, subject: e.target.value })
          }
          onFocus={() => setFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setFocused(false), 150);
          }}
          placeholder="e.g. Biology"
          className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3.5 text-[15px] tracking-[-0.015em] text-neutral-900 placeholder:text-neutral-400 outline-none transition hover:border-black/[0.12] focus:border-neutral-900 focus:ring-[3px] focus:ring-neutral-900/[0.08]"
          autoComplete="off"
          autoFocus={index === 0}
        />
        {showSuggestions ? (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-20 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="flex w-full px-3.5 py-2.5 text-left text-[14px] text-neutral-800 transition hover:bg-neutral-50"
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

      {/* Grades — only after subject started (progressive disclosure feel) */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.1em] text-neutral-400 uppercase">
          <GraduationCap className="size-3 opacity-70" strokeWidth={1.75} />
          Grades
        </p>
        <div className="flex flex-wrap gap-2">
          {GRADES.map((g) => (
            <SelectChip
              key={g}
              selected={assignment.grades.includes(g)}
              onClick={() => toggleGrade(g)}
            >
              {g}
            </SelectChip>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.1em] text-neutral-400 uppercase">
          <CalendarDays className="size-3 opacity-70" strokeWidth={1.75} />
          Periods
        </p>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <SelectChip
              key={p}
              selected={assignment.periods.includes(p)}
              warn={conflicts.includes(p)}
              onClick={() => togglePeriod(p)}
            >
              {p}
            </SelectChip>
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

const ADVANCE_PRESETS = [7, 14, 21, 30] as const;

/** Admin booking window — large stepper + presets (recognition > raw input). */
function BookingWindowControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const days = Math.min(60, Math.max(1, value || 14));

  function setDays(n: number) {
    onChange(Math.min(60, Math.max(1, Math.round(n))));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white">
      <div className="px-5 pt-5 pb-4 text-center sm:px-6 sm:pt-6">
        <div className="mt-1 flex items-center justify-center gap-4 sm:gap-5">
          <button
            type="button"
            onClick={() => setDays(days - 1)}
            disabled={days <= 1}
            aria-label="Fewer days"
            className={cn(
              "flex size-11 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 transition",
              "hover:border-neutral-300 hover:bg-white active:scale-95",
              "disabled:pointer-events-none disabled:opacity-30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
            )}
          >
            <Minus className="size-4" strokeWidth={2} />
          </button>

          <div className="min-w-[7.5rem] tabular-nums">
            <p className="text-[3.25rem] font-extralight leading-none tracking-[-0.05em] text-neutral-950 sm:text-[3.5rem]">
              {days}
            </p>
            <p className="mt-1.5 text-[13px] font-normal text-neutral-400">
              {days === 1 ? "day ahead" : "days ahead"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDays(days + 1)}
            disabled={days >= 60}
            aria-label="More days"
            className={cn(
              "flex size-11 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 transition",
              "hover:border-neutral-300 hover:bg-white active:scale-95",
              "disabled:pointer-events-none disabled:opacity-30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
            )}
          >
            <Plus className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="border-t border-neutral-100 bg-neutral-50/70 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {ADVANCE_PRESETS.map((preset) => {
            const active = days === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setDays(preset)}
                className={cn(
                  "h-9 min-w-[3.25rem] rounded-full px-3.5 text-[13px] font-medium tabular-nums transition-all active:scale-[0.97]",
                  active
                    ? "bg-neutral-950 text-white shadow-sm shadow-neutral-950/15"
                    : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900",
                )}
              >
                {preset}d
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── main wizard ────────────────────────────────────────── */

export function OnboardingWizard({ user }: { user: SessionUser }) {
  const router = useRouter();
  const platform = usePlatformStore();
  const isAdmin = user.role === "admin";
  const steps = isAdmin ? ADMIN_STEPS : TEACHER_STEPS;
  const fileRef = useRef<HTMLInputElement>(null);
  const draftHydrated = useRef(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Prefer Google OAuth photo (auto-fetched at sign-in); custom upload overrides.
  const [avatarSrc, setAvatarSrc] = useState(user.avatarUrl);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [customPhotoChosen, setCustomPhotoChosen] = useState(false);

  const [assignments, setAssignments] = useState<TeachingAssignment[]>([
    newTeachingAssignment(),
  ]);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(
    platform.bookingPolicy.maxAdvanceDays ?? 14,
  );
  // Defaults on — change later in Settings, not during setup.
  const notifyEmail = true;
  const notifyIssues = true;

  // Session may hydrate Google avatar after first paint (OAuth sync).
  useEffect(() => {
    if (customPhotoChosen || avatarDataUrl) return;
    if (user.avatarUrl) setAvatarSrc(user.avatarUrl);
  }, [user.avatarUrl, customPhotoChosen, avatarDataUrl]);

  useEffect(() => {
    if (draftHydrated.current) return;
    draftHydrated.current = true;
    const draft = getOnboardingDraft(user.id, user.email);
    if (!draft) return;
    // Map older multi-step drafts onto current 3 steps
    if (typeof draft.stepIndex === "number") {
      const mapped = Math.min(Math.max(0, draft.stepIndex), steps.length - 1);
      setStepIndex(mapped);
    }
    if (draft.avatarDataUrl) {
      setAvatarDataUrl(draft.avatarDataUrl);
      setAvatarSrc(draft.avatarDataUrl);
      setCustomPhotoChosen(true);
    }
    if (draft.assignments?.length) setAssignments(draft.assignments);
    if (typeof draft.maxAdvanceDays === "number") {
      setMaxAdvanceDays(draft.maxAdvanceDays);
    }
  }, [user.id, user.email, steps.length]);

  useEffect(() => {
    if (!draftHydrated.current) return;
    const t = window.setTimeout(() => {
      saveOnboardingDraft(
        {
          stepIndex,
          avatarDataUrl,
          assignments: isAdmin ? undefined : assignments,
          maxAdvanceDays: isAdmin ? maxAdvanceDays : undefined,
        },
        user.id,
        user.email,
      );
    }, 350);
    return () => window.clearTimeout(t);
  }, [
    stepIndex,
    avatarDataUrl,
    assignments,
    maxAdvanceDays,
    isAdmin,
    user.id,
    user.email,
  ]);

  const step = steps[stepIndex]?.id ?? "welcome";
  const firstName = user.firstName || user.name.split(" ")[0] || "there";
  const initials = (user.name || "U")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const validAssignments = useMemo(
    () => assignments.filter(isAssignmentComplete),
    [assignments],
  );

  const teachingOk = useMemo(() => {
    if (validAssignments.length === 0) return false;
    return assignments.every((a) => {
      const empty =
        !a.subject.trim() && a.grades.length === 0 && a.periods.length === 0;
      return empty || isAssignmentComplete(a);
    });
  }, [assignments, validAssignments.length]);

  const setupOk = isAdmin ? true : teachingOk;
  const periodConflict = !isAdmin && hasPeriodConflicts(assignments);

  const canContinueFromStep =
    step === "welcome" ? true : step === "setup" ? setupOk : true;

  async function onPickAvatar(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarDataUrl(dataUrl);
      setAvatarSrc(dataUrl);
      setCustomPhotoChosen(true);
    } catch (err) {
      toast({
        title: "Could not use that image",
        description: err instanceof Error ? err.message : "Try another file.",
        variant: "destructive",
      });
    }
  }

  function goNext() {
    setError(null);
    if (step === "setup") {
      if (!setupOk) {
        setError(
          isAdmin ? "Set a booking window." : "Add one complete subject.",
        );
        return;
      }
      void finish();
      return;
    }
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }

  function goBack() {
    setError(null);
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  async function finish() {
    if (!setupOk) {
      setError(
        isAdmin ? "Set a booking window." : "Add one complete subject.",
      );
      setStepIndex(1);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const cleaned = assignments
        .filter(isAssignmentComplete)
        .map((a) => ({ ...a, subject: a.subject.trim() }));

      const prefs: Omit<OnboardingPrefs, "completed" | "completedAt"> = {
        department: cleaned[0]?.subject.trim() || undefined,
        preferredPeriods: isAdmin
          ? undefined
          : periodsFromAssignments(cleaned),
        teachingAssignments: isAdmin ? undefined : cleaned,
        notifyEmail,
        notifyIssues,
        maxAdvanceDays: isAdmin ? maxAdvanceDays : undefined,
      };

      try {
        const nextAvatar = avatarDataUrl ?? avatarSrc ?? user.avatarUrl;
        await updateProfile({
          name: user.name,
          department: cleaned[0]?.subject.trim() || user.department,
          phone: user.phone,
          bio: user.bio,
          avatarUrl: nextAvatar ?? undefined,
          notifyEmail,
          notifyIssues,
        });
        if (nextAvatar) {
          const s = getSession();
          if (s) setSession({ ...s, avatarUrl: nextAvatar });
        }
      } catch {
        // Local onboarding still completes.
      }

      if (isAdmin) {
        mutate((draft) => {
          draft.bookingPolicy.maxAdvanceDays = Math.min(
            60,
            Math.max(1, maxAdvanceDays),
          );
        });
      }

      completeOnboarding(user.id || user.email, prefs, [user.id, user.email]);
      router.replace(onboardingHomeForRole(user.role));
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-svh max-h-svh items-center justify-center overflow-hidden bg-[#ececef] p-3 sm:p-5 md:p-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void onPickAvatar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div
        className={cn(
          "flex w-full max-w-[900px] overflow-hidden rounded-[1.75rem] border border-black/[0.06] bg-white",
          "h-[min(38rem,calc(100svh-1.5rem))] sm:h-[min(40rem,calc(100svh-2.5rem))]",
          "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_24px_48px_-12px_rgba(0,0,0,0.12)]",
        )}
      >
        <FeatureLaunchPanel />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Header: logo mobile + progress (always visible) */}
          <header className="shrink-0 space-y-3 px-5 pt-5 sm:px-7 sm:pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="md:hidden">
                <CubicleWordmark size="sm" href={null} />
              </div>
              <p className="ml-auto text-[12px] tabular-nums text-neutral-400">
                {stepIndex + 1}
                <span className="text-neutral-300"> / </span>
                {steps.length}
              </p>
            </div>
            <ProgressBar currentIndex={stepIndex} total={steps.length} />
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <AnimatePresence mode="wait">
              {/* ── 1. Easy win: you ── */}
              {step === "welcome" ? (
                <motion.div
                  key="welcome"
                  {...stepTransition}
                  className="flex h-full flex-col"
                >
                  <div className="mb-6">
                    <h1 className="text-[1.5rem] font-extralight tracking-[-0.035em] text-neutral-950 sm:text-[1.65rem]">
                      Hey {firstName}
                    </h1>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-500">
                      {avatarSrc && !customPhotoChosen
                        ? "We pulled this from your Google account. Use a clear, professional photo so colleagues can spot you on the board."
                        : "We use your Google photo when available. Upload a clear, professional headshot so colleagues can identify you easily."}
                    </p>
                  </div>

                  <div className="flex flex-1 flex-col items-center justify-center pb-4">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="group relative outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15 focus-visible:ring-offset-4"
                      aria-label={
                        avatarSrc
                          ? "Change profile photo"
                          : "Upload profile photo"
                      }
                    >
                      <Avatar className="size-28 ring-4 ring-white shadow-[0_12px_40px_rgba(0,0,0,0.1)] sm:size-32">
                        {avatarSrc ? (
                          <AvatarImage
                            src={avatarSrc}
                            alt={user.name}
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        <AvatarFallback className="bg-gradient-to-br from-neutral-100 to-neutral-200 text-2xl font-extralight text-neutral-400">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute inset-0 rounded-full bg-black/0 transition group-hover:bg-black/15" />
                      <span className="absolute right-1 bottom-1 flex size-10 items-center justify-center rounded-full border-[3px] border-white bg-neutral-950 text-white shadow-lg transition group-hover:scale-105">
                        <Camera className="size-4" strokeWidth={1.75} />
                      </span>
                    </button>
                    <p className="mt-5 text-[15px] font-normal tracking-[-0.02em] text-neutral-900">
                      {user.name}
                    </p>
                    <p className="mt-0.5 text-[13px] text-neutral-400">
                      {user.email}
                    </p>
                    {avatarSrc ? (
                      <div className="mt-3 flex flex-col items-center gap-1.5">
                        {customPhotoChosen ? (
                          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-700">
                            <Check className="size-3.5" strokeWidth={2.5} />
                            Looking good
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="text-[13px] font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
                        >
                          {customPhotoChosen
                            ? "Choose a different photo"
                            : "Replace with a professional photo"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="mt-4 text-[13px] font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
                      >
                        Upload a professional photo
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : null}

              {/* ── 2. Core work: setup ── */}
              {step === "setup" ? (
                <motion.div
                  key="setup"
                  {...stepTransition}
                  className="space-y-4"
                >
                  <div>
                    <h1 className="text-[1.5rem] font-extralight tracking-[-0.035em] text-neutral-950 sm:text-[1.65rem]">
                      {isAdmin ? "Booking window" : "What do you teach?"}
                    </h1>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-500">
                      {isAdmin
                        ? "Set how far ahead teachers can plan."
                        : "One row per class. Same periods across classes will warn you."}
                    </p>
                  </div>

                  {isAdmin ? (
                    <BookingWindowControl
                      value={maxAdvanceDays}
                      onChange={setMaxAdvanceDays}
                    />
                  ) : (
                    <div className="space-y-3">
                      {assignments.map((a, i) => (
                        <TeachingLoadBlock
                          key={a.id}
                          assignment={a}
                          index={i}
                          canRemove={assignments.length > 1}
                          conflicts={conflictingPeriodsForAssignment(
                            assignments,
                            a.id,
                          )}
                          onChange={(next) =>
                            setAssignments((prev) =>
                              prev.map((x) => (x.id === a.id ? next : x)),
                            )
                          }
                          onRemove={() =>
                            setAssignments((prev) =>
                              prev.length <= 1
                                ? prev
                                : prev.filter((x) => x.id !== a.id),
                            )
                          }
                          onDuplicate={() =>
                            setAssignments((prev) => [
                              ...prev,
                              {
                                ...newTeachingAssignment(),
                                grades: [...a.grades],
                              },
                            ])
                          }
                        />
                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          setAssignments((prev) => [
                            ...prev,
                            newTeachingAssignment(),
                          ])
                        }
                        className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 text-[13px] font-medium text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-800"
                      >
                        <Plus className="size-3.5" strokeWidth={2} />
                        Another subject
                      </button>

                      {periodConflict ? (
                        <p className="text-center text-[12px] text-amber-700">
                          Some periods are on more than one subject
                        </p>
                      ) : null}
                    </div>
                  )}
                </motion.div>
              ) : null}

            </AnimatePresence>

            {error ? (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700"
              >
                {error}
              </p>
            ) : null}
          </div>

          {/* Sticky actions — one primary path */}
          <footer className="shrink-0 border-t border-neutral-100 bg-white/95 px-5 py-4 backdrop-blur-sm sm:px-7">
            <div className="flex items-center gap-2.5">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={pending}
                  className={cn(
                    authSecondaryButtonClassName,
                    "h-12 w-auto shrink-0 rounded-xl px-4 text-[14px]",
                  )}
                  aria-label="Back"
                >
                  <ArrowLeft className="size-4" strokeWidth={1.75} />
                </button>
              ) : null}

              {step === "welcome" ? (
                <button
                  type="button"
                  onClick={goNext}
                  className={cn(
                    authPrimaryButtonClassName,
                    "h-12 flex-1 rounded-xl text-[15px]",
                  )}
                >
                  Continue
                  <ArrowRight className="size-4 opacity-80" strokeWidth={1.75} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending || !canContinueFromStep}
                  onClick={goNext}
                  className={cn(
                    authPrimaryButtonClassName,
                    "h-12 flex-1 rounded-xl text-[15px]",
                    !canContinueFromStep && !pending && "opacity-40",
                  )}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {pending ? "Opening…" : "Go to Schedule"}
                  {!pending ? (
                    <ArrowRight className="size-4 opacity-80" strokeWidth={1.75} />
                  ) : null}
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
