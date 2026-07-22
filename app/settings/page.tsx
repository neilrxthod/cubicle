"use client";

import { DashboardFrame } from "@/components/app/dashboard-frame";
import { PageShell } from "@/components/app/page-shell";
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
      <PageShell
        narrow
        title="Settings"
        description="Manage your profile, photo, and notification preferences."
      >
        <SettingsForm key={user.id + (user.avatarUrl ?? "") + user.name} user={user} />
      </PageShell>
    </DashboardFrame>
  );
}
