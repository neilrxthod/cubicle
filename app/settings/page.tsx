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
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-5 sm:mb-6">
          <h1 className="type-page-title">Settings</h1>
          <p className="type-body mt-1">Your profile.</p>
        </header>
        <SettingsForm
          key={user.id + (user.avatarUrl ?? "") + user.name}
          user={user}
        />
      </div>
    </DashboardFrame>
  );
}
