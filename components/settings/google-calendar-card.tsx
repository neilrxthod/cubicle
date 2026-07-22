"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Loader2, MoreHorizontal } from "lucide-react";
import { startGoogleCalendarConnect } from "@/lib/calendar/connect";
import {
  hasGoogleProviderToken,
  syncBookingsToGoogle,
} from "@/lib/calendar/google-calendar";
import {
  clearGoogleCalendarPrefs,
  consumePendingCalendarConnect,
  getGoogleCalendarPrefs,
  setGoogleCalendarAutoSync,
  setGoogleCalendarConnected,
  subscribeGoogleCalendarPrefs,
} from "@/lib/calendar/preferences";
import { usePlatformStore } from "@/lib/data/platform-store";
import type { SessionUser } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GoogleCalendarLogo } from "@/components/settings/google-calendar-logo";
import {
  SettingsDivider,
  SettingsRow,
  SettingsToggleRow,
} from "@/components/settings/settings-section";
import { cn } from "@/lib/utils";

export function GoogleCalendarCard({ user }: { user: SessionUser }) {
  const searchParams = useSearchParams();
  const platform = usePlatformStore();
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [prefs, setPrefs] = useState(() => getGoogleCalendarPrefs());
  const [status, setStatus] = useState<{
    type: "ok" | "error";
    message: string;
  } | null>(null);
  const [tokenReady, setTokenReady] = useState<boolean | null>(null);

  const refreshPrefs = useCallback(() => {
    setPrefs(getGoogleCalendarPrefs());
  }, []);

  useEffect(() => subscribeGoogleCalendarPrefs(refreshPrefs), [refreshPrefs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasToken = await hasGoogleProviderToken();
      if (cancelled) return;
      setTokenReady(hasToken);

      const fromRedirect =
        searchParams.get("calendar") === "connected" ||
        consumePendingCalendarConnect();

      if (fromRedirect && hasToken) {
        setGoogleCalendarConnected(true);
        setPrefs(getGoogleCalendarPrefs());
        setStatus({
          type: "ok",
          message: "Connected. New bookings can appear on your calendar.",
        });
      } else if (fromRedirect && !hasToken) {
        setStatus({
          type: "error",
          message: "Calendar access wasn’t granted. Try Connect again.",
        });
      } else if (prefs.connected && !hasToken) {
        setTokenReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const today = format(new Date(), "yyyy-MM-dd");
  const myUpcoming = platform.bookings
    .filter((b) => b.teacherId === user.id && b.date >= today)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.period.localeCompare(b.period),
    );
  const unsyncedCount = myUpcoming.filter((b) => !prefs.eventIds[b.id]).length;
  const connected = prefs.connected;

  function handleConnect() {
    setStatus(null);
    startTransition(async () => {
      const res = await startGoogleCalendarConnect();
      if (!res.ok) setStatus({ type: "error", message: res.error });
    });
  }

  function handleDisconnect() {
    clearGoogleCalendarPrefs();
    setPrefs(getGoogleCalendarPrefs());
    setTokenReady(null);
    setStatus({ type: "ok", message: "Disconnected from Google Calendar." });
  }

  function handleAutoSync(next: boolean) {
    setGoogleCalendarAutoSync(next);
    setPrefs(getGoogleCalendarPrefs());
  }

  async function handleSyncAll() {
    setSyncing(true);
    setStatus(null);
    try {
      const cartMap = new Map(platform.carts.map((c) => [c.id, c]));
      const result = await syncBookingsToGoogle(
        myUpcoming.map((booking) => ({
          booking,
          cart: cartMap.get(booking.cartId),
        })),
      );
      setPrefs(getGoogleCalendarPrefs());
      if (result.failed > 0 && result.created === 0) {
        setStatus({
          type: "error",
          message:
            result.lastError ?? "Couldn’t sync. Reconnect or ask school IT.",
        });
      } else if (result.created === 0) {
        setStatus({ type: "ok", message: "Calendar is already up to date." });
      } else {
        setStatus({
          type: "ok",
          message: `Synced ${result.created} booking${result.created === 1 ? "" : "s"}.`,
        });
      }
    } finally {
      setSyncing(false);
    }
  }

  const statusLine = (() => {
    if (!connected) return "Not connected";
    if (tokenReady === false) return "Needs reconnect";
    if (!prefs.connectedAt) return "Connected";
    try {
      return `Connected · ${format(parseISO(prefs.connectedAt), "MMM d")}`;
    } catch {
      return "Connected";
    }
  })();

  return (
    <div>
      <SettingsRow className="sm:py-4">
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <div className="flex size-11 items-center justify-center overflow-hidden rounded-xl border border-neutral-200/90 bg-white">
              <GoogleCalendarLogo size={40} className="size-[88%]" />
            </div>
            {connected && tokenReady !== false ? (
              <span
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-500"
                title="Connected"
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold tracking-tight text-neutral-950">
              Google Calendar
            </p>
            <p className="mt-0.5 text-[12.5px] text-neutral-500">{statusLine}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {connected ? (
              <>
                <button
                  type="button"
                  disabled={syncing || myUpcoming.length === 0}
                  onClick={() => void handleSyncAll()}
                  className="hidden h-8 items-center rounded-full border border-neutral-200 bg-white px-3 text-[12.5px] font-medium text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-40 sm:inline-flex"
                >
                  {syncing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : unsyncedCount > 0 ? (
                    `Sync ${unsyncedCount}`
                  ) : (
                    "Sync"
                  )}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                      aria-label="Calendar options"
                    >
                      <MoreHorizontal className="size-4" strokeWidth={1.75} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      disabled={syncing || myUpcoming.length === 0}
                      onSelect={() => void handleSyncAll()}
                    >
                      Sync upcoming
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={pending}
                      onSelect={() => handleConnect()}
                    >
                      Reconnect
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onSelect={() => handleDisconnect()}
                    >
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={handleConnect}
                className="inline-flex h-8 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-full bg-neutral-950 px-3.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                ) : null}
                {pending ? "…" : "Connect"}
              </button>
            )}
          </div>
        </div>
      </SettingsRow>

      {connected ? (
        <>
          <SettingsDivider />
          <SettingsToggleRow
            title="Auto-sync bookings"
            description="Create events when you book · remove when you cancel"
            control={
              <Switch
                checked={prefs.autoSync}
                onCheckedChange={handleAutoSync}
                aria-label="Auto-sync bookings"
              />
            }
          />
        </>
      ) : null}

      {status ? (
        <>
          <SettingsDivider />
          <div className="px-4 py-2.5 sm:px-5">
            <p
              role="status"
              className={cn(
                "text-[12.5px] leading-snug",
                status.type === "error" ? "text-red-600" : "text-neutral-500",
              )}
            >
              {status.message}
            </p>
          </div>
        </>
      ) : !connected ? (
        <>
          <SettingsDivider />
          <div className="px-4 py-2.5 sm:px-5">
            <p className="text-[12px] leading-relaxed text-neutral-400">
              Optional. If Connect is blocked by school Google, use{" "}
              <span className="font-medium text-neutral-500">
                Add to Calendar
              </span>{" "}
              on any booking instead.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
