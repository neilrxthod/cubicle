"use client";

import { DashboardFrame } from "@/components/app/dashboard-frame";
import { RequirePlatformAuth } from "@/components/app/require-platform-auth";
import { SettingsForm } from "@/components/settings/settings-form";
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
      <div className="mx-auto w-full max-w-md sm:max-w-[30rem]">
        <header className="mb-8">
          <h1 className="type-heading text-neutral-950">Settings</h1>
          <p className="mt-1 text-[12.5px] text-neutral-400">
            Profile, schedule, and account
          </p>
        </header>

        <SettingsForm
          key={user.id + (user.avatarUrl ?? "") + user.name}
          user={user}
        />
      </div>
    </DashboardFrame>
  );
}
