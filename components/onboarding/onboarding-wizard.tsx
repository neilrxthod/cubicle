"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CubicleWordmark } from "@/components/auth/wordmark";
import {
  completeOnboarding,
  onboardingHomeForRole,
  type OnboardingPrefs,
} from "@/lib/onboarding/storage";
import { PERIODS, type SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlatformStore, mutate } from "@/lib/data/platform-store";
import { updateProfile } from "@/lib/actions";

const fieldClass =
  "h-11 w-full rounded-xl border border-black/[0.08] bg-[#fafafa] px-3.5 text-[14px] tracking-[-0.011em] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-[3px] focus:ring-neutral-900/[0.08]";

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 rounded-full transition-all",
            i === step ? "w-6 bg-neutral-950" : "w-1.5 bg-neutral-200",
          )}
        />
      ))}
    </div>
  );
}

export function OnboardingWizard({ user }: { user: SessionUser }) {
  const router = useRouter();
  const platform = usePlatformStore();
  const isAdmin = user.role === "admin";
  const totalSteps = 4;
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(user.title ?? "");
  const [department, setDepartment] = useState(user.department ?? "");
  const [preferredPeriods, setPreferredPeriods] = useState<string[]>(["P2", "P3"]);
  const [notifyEmail, setNotifyEmail] = useState(user.notifyEmail ?? true);
  const [notifyIssues, setNotifyIssues] = useState(user.notifyIssues ?? true);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(
    platform.bookingPolicy.maxAdvanceDays ?? 14,
  );
  const [confirmedFleet, setConfirmedFleet] = useState(false);
  const [patternNote, setPatternNote] = useState("");

  const suggestions = useMemo(() => {
    if (isAdmin) {
      const active = platform.carts.filter((c) => c.status === "active").length;
      const open = platform.issues.filter((i) => i.status === "open").length;
      return [
        `${active} carts ready for the board`,
        `${platform.users.filter((u) => u.role === "teacher").length} teachers on the roster`,
        open > 0 ? `${open} open maintenance issues to triage` : "No open issues — fleet looks healthy",
      ];
    }
    const mine = platform.bookings.filter((b) => b.teacherId === user.id);
    const periods = preferredPeriods.length
      ? preferredPeriods.join(", ")
      : "any period";
    return [
      mine.length
        ? `${mine.length} existing booking${mine.length === 1 ? "" : "s"} in demo data`
        : "Board is clear — book your first cart from Schedule",
      `We’ll surface free slots first around ${periods}`,
      patternNote.trim()
        ? `Noted: “${patternNote.trim().slice(0, 48)}${patternNote.length > 48 ? "…" : ""}”`
        : "Patterns learn from your bookings over the week",
    ];
  }, [isAdmin, platform, user.id, preferredPeriods, patternNote]);

  function togglePeriod(p: string) {
    setPreferredPeriods((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort(),
    );
  }

  async function finish() {
    setPending(true);
    setError(null);
    try {
      const prefs: Omit<OnboardingPrefs, "completed" | "completedAt"> = {
        title: title.trim() || undefined,
        department: department.trim() || undefined,
        preferredPeriods: isAdmin ? undefined : preferredPeriods,
        notifyEmail,
        notifyIssues,
        maxAdvanceDays: isAdmin ? maxAdvanceDays : undefined,
        confirmedFleet: isAdmin ? confirmedFleet : undefined,
        patternNote: patternNote.trim() || undefined,
      };

      // Persist profile fields when possible (demo / remote) — non-blocking.
      try {
        await updateProfile({
          name: user.name,
          title: title.trim() || undefined,
          department: department.trim() || undefined,
          phone: user.phone,
          bio: user.bio,
          notifyEmail,
          notifyIssues,
        });
      } catch {
        // Local onboarding prefs still apply if profile API is unavailable.
      }

      if (isAdmin) {
        mutate((draft) => {
          draft.bookingPolicy.maxAdvanceDays = Math.min(
            60,
            Math.max(1, maxAdvanceDays),
          );
        });
      }

      completeOnboarding(user.id || user.email, prefs);
      router.replace(onboardingHomeForRole(user.role));
    } catch {
      setError("Could not save setup. Try again.");
    } finally {
      setPending(false);
    }
  }

  function next() {
    if (step >= totalSteps - 1) {
      void finish();
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <div className="flex min-h-svh flex-col bg-[#f6f6f7]">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <CubicleWordmark size="sm" href={null} />
        <StepDots step={step} total={totalSteps} />
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pb-10 sm:px-8">
        <div className="flex flex-1 flex-col justify-center py-6">
          {step === 0 && (
            <div className="space-y-5">
              <p className="type-label text-neutral-400">
                {isAdmin ? "Admin setup" : "Teacher setup"}
              </p>
              <h1 className="text-[1.75rem] font-medium tracking-[-0.04em] text-neutral-950 sm:text-[2rem]">
                {isAdmin
                  ? "Set up your school workspace"
                  : "Set up how you book carts"}
              </h1>
              <p className="text-[15px] leading-relaxed text-neutral-500">
                {isAdmin
                  ? "One short pass to align booking policy, fleet, and staff patterns — so the board stays fast all year."
                  : "Tell Cubicle your role, preferred periods, and habits. We use that plus board patterns to surface free slots faster."}
              </p>
              <ul className="space-y-2 rounded-2xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)]">
                {suggestions.map((line) => (
                  <li
                    key={line}
                    className="flex gap-2.5 text-[13.5px] text-neutral-700"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neutral-900" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h1 className="text-[1.5rem] font-medium tracking-[-0.035em] text-neutral-950">
                Your profile
              </h1>
              <p className="text-[14px] text-neutral-500">
                Shown on bookings and the staff directory.
              </p>
              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="type-label">Title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={fieldClass}
                    placeholder={isAdmin ? "IT coordinator" : "Science teacher"}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="type-label">Department</span>
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={fieldClass}
                    placeholder={isAdmin ? "Technology" : "Science"}
                  />
                </label>
              </div>
            </div>
          )}

          {step === 2 && !isAdmin && (
            <div className="space-y-5">
              <h1 className="text-[1.5rem] font-medium tracking-[-0.035em] text-neutral-950">
                Booking patterns
              </h1>
              <p className="text-[14px] text-neutral-500">
                Prefer periods you teach with laptops most often. Cubicle ranks
                free slots around these.
              </p>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((p) => {
                  const on = preferredPeriods.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePeriod(p)}
                      className={cn(
                        "h-9 rounded-lg px-3.5 text-[13px] font-medium transition-colors",
                        on
                          ? "bg-neutral-950 text-white"
                          : "border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300",
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <label className="block space-y-1.5">
                <span className="type-label">Anything we should know?</span>
                <textarea
                  value={patternNote}
                  onChange={(e) => setPatternNote(e.target.value)}
                  rows={3}
                  maxLength={160}
                  placeholder="e.g. Lab days Tue/Thu · need carts near Room 214"
                  className={cn(fieldClass, "h-auto min-h-[88px] resize-none py-3")}
                />
              </label>
              <div className="space-y-3 rounded-2xl border border-[var(--hairline-strong)] bg-white p-4">
                <label className="flex items-center justify-between gap-3 text-[13.5px] text-neutral-800">
                  Email when booking changes
                  <input
                    type="checkbox"
                    checked={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.checked)}
                    className="size-4 rounded border-neutral-300"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-[13.5px] text-neutral-800">
                  Alerts for cart issues
                  <input
                    type="checkbox"
                    checked={notifyIssues}
                    onChange={(e) => setNotifyIssues(e.target.checked)}
                    className="size-4 rounded border-neutral-300"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 2 && isAdmin && (
            <div className="space-y-5">
              <h1 className="text-[1.5rem] font-medium tracking-[-0.035em] text-neutral-950">
                Booking policy
              </h1>
              <p className="text-[14px] text-neutral-500">
                How far ahead teachers may reserve carts.
              </p>
              <label className="block space-y-1.5">
                <span className="type-label">Max advance days</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={maxAdvanceDays}
                  onChange={(e) =>
                    setMaxAdvanceDays(Number(e.target.value) || 14)
                  }
                  className={fieldClass}
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--hairline-strong)] bg-white p-4">
                <input
                  type="checkbox"
                  checked={confirmedFleet}
                  onChange={(e) => setConfirmedFleet(e.target.checked)}
                  className="mt-1 size-4 rounded border-neutral-300"
                />
                <span>
                  <span className="block text-[14px] font-medium text-neutral-900">
                    Confirm demo fleet ({platform.carts.length} carts)
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-neutral-500">
                    You can rename, retire, or add carts anytime in Admin.
                  </span>
                </span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h1 className="text-[1.5rem] font-medium tracking-[-0.035em] text-neutral-950">
                You&apos;re ready
              </h1>
              <p className="text-[14px] leading-relaxed text-neutral-500">
                {isAdmin
                  ? "Open Admin to manage staff, restrictions, and fleet health. The Schedule board reflects live demo data so you can walk through a full day."
                  : "Open Schedule, pick a free cell, and book. Cubicle will keep learning from your preferred periods and class patterns."}
              </p>
              <ul className="space-y-2.5 rounded-2xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)]">
                {suggestions.map((line) => (
                  <li
                    key={line}
                    className="text-[13.5px] leading-snug text-neutral-700"
                  >
                    {line}
                  </li>
                ))}
              </ul>
              {error ? (
                <p className="text-[13px] text-red-600">{error}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-4">
          <button
            type="button"
            onClick={back}
            disabled={step === 0 || pending}
            className="h-11 rounded-xl px-4 text-[14px] font-medium text-neutral-500 transition hover:text-neutral-900 disabled:opacity-0"
          >
            Back
          </button>
          <button
            type="button"
            onClick={next}
            disabled={pending || (isAdmin && step === 2 && !confirmedFleet)}
            className="h-11 min-w-[8.5rem] rounded-xl bg-neutral-950 px-6 text-[14px] font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending
              ? "Saving…"
              : step === totalSteps - 1
                ? "Enter Cubicle"
                : "Continue"}
          </button>
        </div>
      </main>
    </div>
  );
}
