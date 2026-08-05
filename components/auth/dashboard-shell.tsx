"use client";

import type { SessionUser } from "@/lib/auth/types";
import { CubicleWordmark } from "./wordmark";
import { useLogout } from "./require-auth";

type DashboardShellProps = {
  user: SessionUser;
  title: string;
  description: string;
};

export function DashboardShell({
  user,
  title,
  description,
}: DashboardShellProps) {
  const logout = useLogout();

  return (
    <div className="min-h-dvh w-full min-w-0 bg-[#fafafa]">
      <header className="sticky top-0 z-10 border-b border-black/[0.06] bg-white/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[min(100%,45rem)] items-center justify-between px-[max(1.25rem,env(safe-area-inset-left,0px))] py-3.5 pr-[max(1.25rem,env(safe-area-inset-right,0px))]">
          <CubicleWordmark size="md" href={null} />

          <button
            type="button"
            onClick={logout}
            className="text-[13.5px] font-medium text-neutral-500 transition-colors hover:text-neutral-950"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[min(100%,45rem)] px-[max(1.25rem,env(safe-area-inset-left,0px))] py-8 pr-[max(1.25rem,env(safe-area-inset-right,0px))] sm:py-10">
        <section className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
            {user.role}
          </p>
          <h1 className="type-heading mt-2 break-words text-neutral-950">
            {title}
          </h1>
          <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed text-neutral-500">
            {description}
          </p>

          <div className="mt-8 border-t border-black/[0.05] pt-6">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-[12px] font-medium text-neutral-400">Name</dt>
                <dd className="mt-1 truncate text-[15px] text-neutral-950">
                  {user.name}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[12px] font-medium text-neutral-400">
                  Account
                </dt>
                <dd className="mt-1 break-all text-[15px] text-neutral-950">
                  {user.email}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
    </div>
  );
}
