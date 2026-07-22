"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, ChevronDown } from "lucide-react";
import { DashboardFrame } from "@/components/app/dashboard-frame";
import { PageShell } from "@/components/app/page-shell";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { IssueDialog } from "@/components/issue-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updateIssueStatus } from "@/lib/actions";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { Issue, IssueSeverity, IssueStatus, SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type StatusTab = "open" | "resolved" | "all";
type SeverityFilter = "all" | IssueSeverity;

const SEVERITY_OPTIONS: Array<{
  id: SeverityFilter;
  label: string;
  description: string;
  dot: string;
}> = [
  {
    id: "all",
    label: "Any severity",
    description: "Show everything",
    dot: "bg-neutral-300",
  },
  {
    id: "high",
    label: "High",
    description: "Unusable / urgent",
    dot: "bg-red-500",
  },
  {
    id: "medium",
    label: "Medium",
    description: "Partial impact",
    dot: "bg-amber-400",
  },
  {
    id: "low",
    label: "Low",
    description: "Still usable",
    dot: "bg-neutral-300",
  },
];

/** Keep list panel height stable across empty/full tab switches */
const LIST_MIN_HEIGHT = "min-h-[28rem]";

export default function IssuesPage() {
  return (
    <RequirePlatformAuth>
      {(user) => <IssuesView user={user} />}
    </RequirePlatformAuth>
  );
}

function IssuesView({ user }: { user: SessionUser }) {
  const state = usePlatformStore();
  const isAdmin = user.role === "admin";

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<StatusTab>("open");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [severityOpen, setSeverityOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const selectedSeverity =
    SEVERITY_OPTIONS.find((option) => option.id === severity) ??
    SEVERITY_OPTIONS[0];

  const cartMap = useMemo(
    () => new Map(state.carts.map((c) => [c.id, c])),
    [state.carts],
  );

  const issues = useMemo(() => {
    const list = isAdmin
      ? state.issues
      : state.issues.filter((i) => i.reportedById === user.id);
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [state.issues, isAdmin, user.id]);

  const counts = useMemo(
    () => ({
      open: issues.filter((i) => i.status === "open").length,
      resolved: issues.filter((i) => i.status === "resolved").length,
      high: issues.filter((i) => i.status === "open" && i.severity === "high")
        .length,
    }),
    [issues],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((issue) => {
      if (tab === "open" && issue.status !== "open") return false;
      if (tab === "resolved" && issue.status !== "resolved") return false;
      if (severity !== "all" && issue.severity !== severity) return false;
      if (!q) return true;
      const cart = cartMap.get(issue.cartId);
      return [
        issue.description,
        issue.reporterName,
        cart?.name,
        cart?.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [issues, tab, severity, query, cartMap]);

  async function setStatus(issue: Issue, next: IssueStatus) {
    setBusyId(issue.id);
    try {
      const res = await updateIssueStatus(issue.id, next);
      if (!res.ok) {
        toast({
          title: "Could not update",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: next === "resolved" ? "Resolved" : "Reopened",
        description:
          next === "resolved" ? "Marked as fixed." : "Issue is open again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const showHighNote = tab === "open" && counts.high > 0;

  return (
    <DashboardFrame user={user}>
      <PageShell
        narrow
        title="Issues"
        description={isAdmin ? "Open cart problems." : "Your reports."}
        action={
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="h-9 rounded-lg bg-neutral-950 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Report
          </button>
        }
      >
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex h-9 w-full items-center rounded-lg border border-neutral-200/90 bg-neutral-100/80 p-0.5 sm:w-auto">
            {(
              [
                { id: "open", label: "Open", count: counts.open },
                { id: "resolved", label: "Resolved", count: counts.resolved },
                { id: "all", label: "All", count: issues.length },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-3 text-[12.5px] font-medium transition-colors sm:flex-none sm:min-w-[5.5rem]",
                  tab === item.id
                    ? "bg-white text-neutral-950 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                <span>{item.label}</span>
                <span className="text-[11px] tabular-nums text-neutral-400">
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex h-9 shrink-0 items-center gap-2">
            <Popover open={severityOpen} onOpenChange={setSeverityOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Filter by severity"
                  className={cn(
                    "inline-flex h-8 w-[9.5rem] items-center gap-2 rounded-full border border-neutral-200 bg-white py-0 pl-2.5 pr-2 text-[12.5px] font-medium transition-colors",
                    "text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
                    severityOpen && "border-neutral-300 bg-neutral-50",
                    severity !== "all" && "border-neutral-300 text-neutral-950",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      selectedSeverity.dot,
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {selectedSeverity.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 text-neutral-400 transition-transform duration-200",
                      severityOpen && "rotate-180",
                    )}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-56 rounded-xl border-neutral-200 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
              >
                <div className="px-2.5 pb-1.5 pt-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-400">
                    Severity
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  {SEVERITY_OPTIONS.map((option) => {
                    const active = severity === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setSeverity(option.id);
                          setSeverityOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                          active ? "bg-neutral-100" : "hover:bg-neutral-50",
                        )}
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full ring-2 ring-white",
                            option.dot,
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-neutral-950">
                            {option.label}
                          </span>
                          <span className="block text-[11.5px] text-neutral-400">
                            {option.description}
                          </span>
                        </span>
                        <Check
                          className={cn(
                            "size-3.5 shrink-0 text-neutral-950 transition-opacity",
                            active ? "opacity-100" : "opacity-0",
                          )}
                          strokeWidth={2.5}
                        />
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 w-36 shrink-0 rounded-full border border-neutral-200 bg-white px-3.5 text-[12.5px] text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-0 sm:w-40"
            />
          </div>
        </div>

        <div className="mb-3 flex h-5 items-center">
          <p
            className={cn(
              "text-[12.5px] text-neutral-500 transition-opacity duration-150",
              showHighNote ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={!showHighNote}
          >
            <span className="font-medium tabular-nums text-neutral-800">
              {counts.high || 1}
            </span>
            {" high priority"}
          </p>
        </div>

        <div
          className={cn(
            "overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]",
            LIST_MIN_HEIGHT,
          )}
        >
          {filtered.length === 0 ? (
            <div className={cn("flex h-full flex-col", LIST_MIN_HEIGHT)}>
              <EmptyState
                hasAny={issues.length > 0}
                onReport={() => setReportOpen(true)}
                onReset={() => {
                  setQuery("");
                  setSeverity("all");
                  setTab("open");
                }}
              />
            </div>
          ) : (
            <div
              className={cn(
                "overflow-y-auto overscroll-contain",
                LIST_MIN_HEIGHT,
              )}
            >
              <ul>
                {filtered.map((issue, index) => {
                  const cart = cartMap.get(issue.cartId);
                  const busy = busyId === issue.id;

                  return (
                    <li
                      key={issue.id}
                      className={cn(
                        "group grid min-h-[4.75rem] gap-2 px-4 py-3.5 transition-colors hover:bg-neutral-50/80 sm:grid-cols-[minmax(0,1fr)_5rem] sm:items-center sm:gap-3 sm:px-5",
                        index > 0 && "border-t border-neutral-100",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex h-5 items-center gap-2">
                          <SeverityDot severity={issue.severity} />
                          <span className="truncate text-[13.5px] font-medium tracking-[-0.01em] text-neutral-950">
                            {cart?.name ?? "Cart"}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-[11px]",
                              issue.status === "resolved"
                                ? "text-neutral-400"
                                : "invisible",
                            )}
                          >
                            Resolved
                          </span>
                        </div>

                        <p className="mt-1 line-clamp-1 text-[13px] leading-snug text-neutral-600">
                          {issue.description}
                        </p>

                        <p className="mt-1 truncate text-[12px] text-neutral-400">
                          {issue.reporterName}
                          <span className="mx-1.5 text-neutral-300">·</span>
                          {format(parseISO(issue.createdAt), "MMM d")}
                          {cart?.location ? (
                            <>
                              <span className="mx-1.5 text-neutral-300">·</span>
                              {cart.location}
                            </>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex h-8 items-center sm:justify-end">
                        {isAdmin ? (
                          issue.status === "open" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setStatus(issue, "resolved")}
                              className="h-8 w-[4.5rem] rounded-full bg-neutral-950 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                            >
                              {busy ? "..." : "Resolve"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setStatus(issue, "open")}
                              className="h-8 w-[4.5rem] rounded-full text-[12.5px] font-medium text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40"
                            >
                              {busy ? "..." : "Reopen"}
                            </button>
                          )
                        ) : (
                          <span className="invisible h-8 w-[4.5rem]" aria-hidden />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </PageShell>

      {reportOpen ? (
        <IssueDialog carts={state.carts} onClose={() => setReportOpen(false)} />
      ) : null}
    </DashboardFrame>
  );
}

function SeverityDot({ severity }: { severity: IssueSeverity }) {
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        severity === "high"
          ? "bg-red-500"
          : severity === "medium"
            ? "bg-amber-400"
            : "bg-neutral-300",
      )}
      title={severity}
      aria-label={`${severity} severity`}
    />
  );
}

function EmptyState({
  hasAny,
  onReport,
  onReset,
}: {
  hasAny: boolean;
  onReport: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[15px] font-medium tracking-tight text-neutral-950">
        {hasAny ? "No matches" : "No open issues"}
      </p>
      <p className="mt-1.5 max-w-[260px] text-[13px] text-neutral-500">
        {hasAny ? "Try another filter." : "Report a cart problem to start."}
      </p>
      <button
        type="button"
        onClick={hasAny ? onReset : onReport}
        className="mt-5 h-9 rounded-lg border border-neutral-200 bg-white px-4 text-[13px] font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
      >
        {hasAny ? "Clear filters" : "Report"}
      </button>
    </div>
  );
}
