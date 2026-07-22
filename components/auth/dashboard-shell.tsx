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
    <div className="min-h-screen bg-[#fafafa]">
      <header className="sticky top-0 z-10 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-6 py-3.5">
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

      <main className="mx-auto max-w-[720px] px-6 py-10">
        <section className="rounded-2xl border border-black/[0.06] bg-white p-7 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
            {user.role}
          </p>
          <h1 className="mt-2 text-[1.625rem] font-semibold tracking-[-0.03em] text-neutral-950">
            {title}
          </h1>
          <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed text-neutral-500">
            {description}
          </p>

          <div className="mt-8 border-t border-black/[0.05] pt-6">
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-[12px] font-medium text-neutral-400">Name</dt>
                <dd className="mt-1 text-[15px] text-neutral-950">{user.name}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium text-neutral-400">
                  Account
                </dt>
                <dd className="mt-1 text-[15px] text-neutral-950">{user.email}</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
    </div>
  );
}
