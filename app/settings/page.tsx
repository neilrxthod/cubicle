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
      <div className="mx-auto w-full max-w-md sm:max-w-[28rem]">
        <header className="mb-8">
          <h1 className="text-[1.375rem] font-semibold tracking-[-0.035em] text-neutral-950">
            Settings
          </h1>
        </header>

        <SettingsForm
          key={user.id + (user.avatarUrl ?? "") + user.name}
          user={user}
        />
      </div>
    </DashboardFrame>
  );
}
