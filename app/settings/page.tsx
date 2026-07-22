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
  return (
    <DashboardFrame user={user}>
      <div className="mx-auto w-full max-w-md sm:max-w-[28rem]">
        <header className="mb-8">
          <h1 className="text-[1.375rem] font-semibold tracking-[-0.035em] text-neutral-950">
            Settings
          </h1>
        </header>

        <SettingsForm
          key={user.id + (user.avatarUrl ?? "") + user.name}
          user={user}
          integrations={
            <SettingsSection id="integrations" title="Integrations">
              <Suspense
                fallback={
                  <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                    <div className="size-9 animate-pulse rounded-[10px] bg-neutral-100" />
                    <div className="h-3 w-28 animate-pulse rounded bg-neutral-100" />
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
