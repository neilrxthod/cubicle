"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { DashboardFrame } from "@/components/app/dashboard-frame";
import { PageShell } from "@/components/app/page-shell";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { IssueDialog } from "@/components/issue-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateIssueStatus } from "@/lib/actions";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { Issue, IssueSeverity, IssueStatus, SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type StatusTab = "open" | "resolved" | "all";
type SeverityFilter = "all" | IssueSeverity;

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
  const [reportOpen, setReportOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      return [issue.description, issue.reporterName, cart?.name, cart?.location]
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
      });
    } finally {
      setBusyId(null);
    }
  }

  const tabs = [
    {
      id: "open" as const,
      label: "Open",
      count: counts.open,
      countClass: "text-red-600",
      activeBar: "bg-red-600",
    },
    {
      id: "resolved" as const,
      label: "Resolved",
      count: counts.resolved,
      countClass: "text-emerald-600",
      activeBar: "bg-emerald-600",
    },
    {
      id: "all" as const,
      label: "All",
      count: issues.length,
      countClass: "text-neutral-400",
      activeBar: "bg-neutral-950",
    },
  ];

  return (
    <DashboardFrame user={user}>
      <PageShell narrow contentClassName="space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <nav
            aria-label="Issue status"
            className="flex items-center gap-1 border-b border-[var(--hairline)] sm:border-0"
          >
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "relative inline-flex h-9 items-center gap-1.5 px-2.5 text-[13px] font-medium transition-colors",
                    active
                      ? "text-neutral-950"
                      : "text-neutral-400 hover:text-neutral-700",
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "text-[12px] tabular-nums",
                      active || item.count > 0
                        ? item.countClass
                        : "text-neutral-400",
                    )}
                  >
                    {item.count}
                  </span>
                  {active ? (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-2 -bottom-px h-px sm:bottom-0",
                        item.activeBar,
                      )}
                    />
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={severity}
              onValueChange={(value) =>
                setSeverity((value ?? "all") as SeverityFilter)
              }
            >
              <SelectTrigger
                size="sm"
                aria-label="Severity"
                className={cn(
                  "h-8 min-w-[8.75rem] gap-1.5 rounded-md border-[var(--hairline-strong)] bg-white px-2.5",
                  "text-[12.5px] font-medium text-neutral-700 shadow-none",
                  "transition-[background-color,border-color,color] duration-150 ease-out",
                  "hover:border-neutral-300 hover:bg-neutral-50",
                  "data-[state=open]:border-neutral-400 data-[state=open]:bg-neutral-50",
                  "focus-visible:border-neutral-400 focus-visible:ring-0",
                  "[&_svg]:size-3.5 [&_svg]:opacity-45",
                  "[&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "data-[state=open]:[&_svg]:rotate-180",
                )}
              >
                <SelectValue placeholder="All severity" />
              </SelectTrigger>
              <SelectContent
                align="start"
                position="popper"
                className={cn(
                  "min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg",
                  "border-[var(--hairline-strong)] bg-white",
                  "shadow-[var(--shadow-soft)]",
                  "data-[state=open]:duration-200 data-[state=closed]:duration-150",
                  "data-[state=open]:ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "data-[state=closed]:ease-in",
                )}
              >
                {(
                  [
                    { value: "all", label: "All severity" },
                    { value: "high", label: "High" },
                    { value: "medium", label: "Medium" },
                    { value: "low", label: "Low" },
                  ] as const
                ).map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className={cn(
                      "cursor-pointer rounded-md py-1.5 pl-2 pr-8 text-[12.5px] text-neutral-700",
                      "transition-colors duration-150 ease-out",
                      "focus:bg-neutral-100 focus:text-neutral-950",
                      "data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-950",
                    )}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className={cn(
                "h-8 w-full min-w-0 rounded-md border border-[var(--hairline-strong)] bg-white px-2.5 sm:w-40",
                "text-[12.5px] text-neutral-900 outline-none placeholder:text-neutral-400",
                "focus:border-neutral-400",
              )}
            />

            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className={cn(
                "inline-flex h-8 items-center rounded-md bg-neutral-950 px-3",
                "text-[12.5px] font-medium text-white",
                "transition-colors hover:bg-neutral-800",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15",
              )}
            >
              Report
            </button>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-[var(--hairline)] bg-white px-5 py-12 text-center">
            <p className="text-[13px] text-neutral-400">
              {issues.length > 0 ? "No matching issues." : "No open issues."}
            </p>
            {issues.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSeverity("all");
                  setTab("open");
                }}
                className="mt-3 text-[13px] font-medium text-neutral-950 underline-offset-4 hover:underline"
              >
                Clear filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="mt-3 text-[13px] font-medium text-neutral-950 underline-offset-4 hover:underline"
              >
                Report an issue
              </button>
            )}
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white">
            {filtered.map((issue, index) => {
              const cart = cartMap.get(issue.cartId);
              const busy = busyId === issue.id;
              const isOpen = issue.status === "open";
              const meta = [
                severityLabel(issue.severity),
                issue.reporterName,
                format(parseISO(issue.createdAt), "MMM d"),
                cart?.location,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li
                  key={issue.id}
                  className={cn(
                    "flex items-start gap-4 px-4 py-3.5 sm:items-center sm:px-5",
                    index > 0 && "border-t border-[var(--hairline)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-neutral-950">
                        {cart?.name ?? "Cart"}
                      </p>
                      <StatusBadge status={issue.status} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-neutral-600 sm:line-clamp-1">
                      {issue.description}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                      {meta}
                    </p>
                  </div>

                  {isAdmin ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setStatus(issue, isOpen ? "resolved" : "open")
                      }
                      className={cn(
                        "shrink-0 rounded-md border px-2.5 py-1.5 text-[12.5px] font-medium",
                        "transition-colors duration-150",
                        "focus-visible:outline-none focus-visible:ring-2",
                        "disabled:pointer-events-none disabled:opacity-40",
                        isOpen
                          ? cn(
                              "border-emerald-200/90 bg-emerald-50 text-emerald-800",
                              "hover:border-emerald-300 hover:bg-emerald-100",
                              "focus-visible:ring-emerald-600/20",
                            )
                          : cn(
                              "border-red-200/90 bg-red-50 text-red-700",
                              "hover:border-red-300 hover:bg-red-100",
                              "focus-visible:ring-red-600/20",
                            ),
                      )}
                    >
                      {busy ? "…" : isOpen ? "Resolve" : "Reopen"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </PageShell>

      {reportOpen ? (
        <IssueDialog carts={state.carts} onClose={() => setReportOpen(false)} />
      ) : null}
    </DashboardFrame>
  );
}

function severityLabel(severity: IssueSeverity) {
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  return "Low";
}

function StatusBadge({ status }: { status: IssueStatus }) {
  const isOpen = status === "open";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5",
        "text-[11px] font-medium tracking-[-0.01em]",
        isOpen
          ? "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200/80"
          : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/80",
      )}
    >
      {isOpen ? "Open" : "Resolved"}
    </span>
  );
}
