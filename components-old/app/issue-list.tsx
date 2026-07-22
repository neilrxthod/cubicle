"use client";

import type { SessionUser } from "@/lib/auth/types";
import { getCart, updateIssueStatus, useCubicleStore } from "@/lib/cubicle/store";
import type { Issue, IssueStatus } from "@/lib/cubicle/types";
import { IssueStatusBadge, SeverityBadge } from "./status";
import {
  EmptyState,
  buttonGhostClassName,
  buttonSecondaryClassName,
} from "./ui";
import { cn } from "@/lib/utils";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function IssueList({
  issues,
  user,
  emptyTitle = "No issues",
  emptyDescription,
}: {
  issues: Issue[];
  user: SessionUser;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const state = useCubicleStore();
  const isAdmin = user.role === "admin";

  if (issues.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="divide-y divide-black/[0.05]">
      {issues.map((issue) => {
        const cart = getCart(state, issue.cartId);

        return (
          <li key={issue.id} className="px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-medium tracking-[-0.01em] text-neutral-950">
                    {issue.title}
                  </p>
                  <SeverityBadge severity={issue.severity} />
                  <IssueStatusBadge status={issue.status} />
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-600">
                  {issue.description}
                </p>
                <p className="mt-2 text-[12.5px] text-neutral-400">
                  {cart?.name ?? "Cart"} · {issue.reportedByName} ·{" "}
                  {formatWhen(issue.createdAt)}
                </p>
              </div>

              {isAdmin && issue.status !== "resolved" ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {issue.status === "open" ? (
                    <button
                      type="button"
                      className={buttonSecondaryClassName}
                      onClick={() =>
                        updateIssueStatus(issue.id, "in_progress")
                      }
                    >
                      Start
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={cn(buttonGhostClassName, "text-emerald-700")}
                    onClick={() => updateIssueStatus(issue.id, "resolved")}
                  >
                    Resolve
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function IssueStatusFilter({
  value,
  onChange,
}: {
  value: "all" | IssueStatus;
  onChange: (value: "all" | IssueStatus) => void;
}) {
  const options: Array<"all" | IssueStatus> = [
    "all",
    "open",
    "in_progress",
    "resolved",
  ];

  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-neutral-100 p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "h-8 rounded-lg px-3 text-[12.5px] font-medium capitalize transition-colors",
            value === option
              ? "bg-white text-neutral-950 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800",
          )}
        >
          {option === "in_progress" ? "In progress" : option}
        </button>
      ))}
    </div>
  );
}
