"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { TeacherMobileNav } from "@/components/app/teacher-mobile-nav";
import { IssueDialog } from "@/components/issue-dialog";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { Issue, SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TeacherMobileIssues({
  user,
  onBack,
}: {
  user: SessionUser;
  onBack: () => void;
}) {
  const { issues, carts } = usePlatformStore();
  const [reportOpen, setReportOpen] = useState(false);

  const mine = useMemo(() => {
    return issues
      .filter((issue) => issue.reportedById === user.id)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [issues, user.id]);

  const open = mine.filter((issue) => issue.status === "open");
  const resolved = mine.filter((issue) => issue.status === "resolved");

  const cartName = (cartId: string) =>
    carts.find((cart) => cart.id === cartId)?.name ?? "Cart";

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top,0px)]">
      <TeacherMobileNav
        title="Issues"
        onBack={onBack}
        trailing={
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="px-3 py-1 text-[17px] font-medium tracking-[-0.02em] text-neutral-950"
          >
            Report
          </button>
        }
      />
      <main className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 pb-8 pt-4">
        <IssueGroup title="Open" issues={open} empty="No open issues" cartName={cartName} />
        <IssueGroup
          title="Resolved"
          issues={resolved}
          empty="No resolved issues"
          cartName={cartName}
        />
      </main>
      {reportOpen ? (
        <IssueDialog carts={carts} onClose={() => setReportOpen(false)} />
      ) : null}
    </div>
  );
}

function IssueGroup({
  title,
  issues,
  empty,
  cartName,
}: {
  title: string;
  issues: Issue[];
  empty: string;
  cartName: (id: string) => string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">
        {title}
      </h2>
      {issues.length === 0 ? (
        <p className="rounded-[12px] bg-white px-4 py-8 text-center text-[15px] text-neutral-400">
          {empty}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[12px] bg-white">
          {issues.map((issue, index) => (
            <li
              key={issue.id}
              className={cn(
                "flex flex-col gap-0.5 px-4 py-3.5",
                index > 0 && "border-t border-neutral-100",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[17px] tracking-[-0.02em] text-neutral-950">
                  {cartName(issue.cartId)}
                </p>
                <span className="shrink-0 text-[13px] text-neutral-400">
                  {issue.status === "open" ? "Open" : "Resolved"}
                </span>
              </div>
              <p className="line-clamp-2 text-[15px] leading-snug text-neutral-500">
                {issue.description}
              </p>
              <p className="text-[13px] text-neutral-400">
                {severityLabel(issue.severity)}
                <span className="text-neutral-200"> · </span>
                {format(parseISO(issue.createdAt), "MMM d")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function severityLabel(severity: Issue["severity"]) {
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  return "Low";
}
