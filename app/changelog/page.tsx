"use client";

import { format, parseISO } from "date-fns";
import { DashboardFrame } from "@/components/app/dashboard-frame";
import { PageShell } from "@/components/app/page-shell";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { APP_VERSION_LABEL } from "@/lib/app-version";
import {
  CHANGELOG,
  type ChangelogEntry,
  type ChangelogKind,
} from "@/lib/changelog";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ChangelogPage() {
  return (
    <RequirePlatformAuth>
      {(user) => <ChangelogView user={user} />}
    </RequirePlatformAuth>
  );
}

function ChangelogView({ user }: { user: SessionUser }) {
  return (
    <DashboardFrame user={user}>
      <PageShell narrow contentClassName="space-y-6">
        {/* Page identity */}
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--hairline)] pb-5">
          <div className="min-w-0">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-neutral-400">
              Product
            </p>
            <h1 className="mt-1.5 text-[1.375rem] font-light tracking-[-0.03em] text-neutral-950 sm:text-[1.5rem]">
              Changelog
            </h1>
            <p className="mt-1.5 text-[13px] text-neutral-400">
              Release notes for the Cubicle platform.
            </p>
          </div>
          <dl className="shrink-0 text-right">
            <dt className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-neutral-400">
              Current
            </dt>
            <dd className="mt-1 text-[13px] font-medium tabular-nums tracking-tight text-neutral-950">
              {APP_VERSION_LABEL}
            </dd>
          </dl>
        </header>

        {/* Release feed */}
        <div className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]">
          <ol className="divide-y divide-[var(--hairline)]">
            {CHANGELOG.map((entry) => (
              <li key={entry.version}>
                <Release entry={entry} />
              </li>
            ))}
          </ol>
        </div>
      </PageShell>
    </DashboardFrame>
  );
}

function kindLabel(kind: ChangelogKind) {
  if (kind === "major") return "Major";
  if (kind === "minor") return "Minor";
  return "Patch";
}

function Release({ entry }: { entry: ChangelogEntry }) {
  return (
    <article className="px-5 py-6 sm:px-6 sm:py-7">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13px] font-medium tabular-nums tracking-tight text-neutral-950">
          v{entry.version}
        </span>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded px-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em]",
            entry.kind === "major"
              ? "bg-neutral-950 text-white"
              : "bg-neutral-100 text-neutral-600",
          )}
        >
          {kindLabel(entry.kind)}
        </span>
        <span className="text-[12px] tabular-nums text-neutral-400">
          {format(parseISO(entry.date), "MMM d, yyyy")}
        </span>
      </div>

      <h2 className="mt-3 text-[14px] font-medium tracking-[-0.015em] text-neutral-950">
        {entry.title}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-neutral-500">
        {entry.summary}
      </p>

      <div className="mt-6 space-y-5">
        <ChangeGroup label="Highlights" items={entry.highlights} />
        {entry.improvements?.length ? (
          <ChangeGroup label="Improvements" items={entry.improvements} />
        ) : null}
        {entry.fixes?.length ? (
          <ChangeGroup label="Fixes" items={entry.fixes} />
        ) : null}
      </div>
    </article>
  );
}

function ChangeGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <section>
      <h3 className="border-b border-[var(--hairline)] pb-2 text-[10.5px] font-medium uppercase tracking-[0.1em] text-neutral-400">
        {label}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="text-[12.5px] leading-relaxed tracking-[-0.01em] text-neutral-700"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
