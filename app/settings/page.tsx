"use client";

import { Suspense } from "react";
import { DashboardFrame } from "@/components/app/dashboard-frame";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { GoogleCalendarCard } from "@/components/settings/google-calendar-card";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingsSection } from "@/components/settings/settings-section";
import type { SessionUser } from "@/lib/types";

export default function SettingsPage() {
  return (
    <RequirePlatformAuth>
      {(user) => <SettingsView user={user} />}
    </RequirePlatformAuth>
  );
}

function SettingsView({ user }: { user: SessionUser }) {
  const isAdmin = user.role === "admin";

  return (
    <DashboardFrame user={user}>
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.03em] text-neutral-950 sm:text-[1.625rem]">
            Settings
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-500">
            {isAdmin
              ? "Your profile, calendar sync, and admin shortcuts."
              : "Your profile, calendar sync, and booking preferences."}
          </p>
        </header>

        <nav
          aria-label="Settings sections"
          className="mb-6 hidden flex-wrap items-center gap-1 sm:flex"
        >
          {[
            { href: "#profile", label: "Profile" },
            { href: "#integrations", label: "Integrations" },
            { href: "#notifications", label: "Email" },
            { href: "#account", label: "Account" },
            { href: "#shortcuts", label: "Shortcuts" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[12px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <SettingsForm
          key={user.id + (user.avatarUrl ?? "") + user.name}
          user={user}
          integrations={
            <SettingsSection
              id="integrations"
              title="Integrations"
              description="Optional tools connected to your school Google account."
            >
              <Suspense
                fallback={
                  <div className="flex items-center gap-3.5 px-4 py-5 sm:px-5">
                    <div className="size-11 animate-pulse rounded-xl bg-neutral-100" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-32 animate-pulse rounded bg-neutral-100" />
                      <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
                    </div>
                  </div>
                }
              >
                <GoogleCalendarCard user={user} />
              </Suspense>
            </SettingsSection>
          }
        />
      </div>
    </DashboardFrame>
  );
}
