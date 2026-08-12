/**
 * Client-safe notification queue.
 * Posts to `/api/notifications` so BREVO_API_KEY never ships to the browser.
 * Failures are swallowed — never blocks booking / issue flows.
 *
 * Local dev: no network call unless Settings → Email (local testing) is on.
 * Production: always queues (server delivers to real recipients).
 */

import {
  localEmailSinkForRequest,
  shouldQueueEmailFromClient,
} from "@/lib/email/local-dev";

export type IssueNotificationPayload = {
  type: "issue_reported";
  cartId: string;
  cartName?: string;
  description: string;
  severity: string;
  reporterName: string;
};

export type ShareInviteNotificationPayload = {
  type: "share_invite";
  inviteeId: string;
  inviterName: string;
  cartName: string;
  date: string;
  period: string;
};

export type DevTestNotificationPayload = {
  type: "dev_test";
};

/** Admin moved a booking to a different cart (maintenance pause or manual reassign). */
export type BookingRelocatedPayload = {
  type: "booking_relocated";
  teacherId: string;
  fromCartName: string;
  toCartName: string;
  date: string;
  period: string;
  reason: "maintenance" | "admin";
};

/** Admin cancelled a booking (e.g. cart paused and booking dropped). */
export type BookingCancelledPayload = {
  type: "booking_cancelled";
  teacherId: string;
  cartName: string;
  date: string;
  period: string;
  reason: "maintenance" | "admin";
};

/** Two teachers exchanged carts (swap accept · exchange). */
export type SwapExchangePayload = {
  type: "swap_exchange";
  teacherAId: string;
  teacherAName: string;
  cartAName: string;
  teacherBId: string;
  teacherBName: string;
  cartBName: string;
  date: string;
  period: string;
};

/** Handoff completed — original owner released the slot to the requester. */
export type SwapHandoffPayload = {
  type: "swap_handoff";
  fromTeacherId: string;
  fromTeacherName: string;
  toTeacherId: string;
  toTeacherName: string;
  cartName: string;
  date: string;
  period: string;
};

/** Someone requested a swap/handoff on your booking. */
export type SwapInvitePayload = {
  type: "swap_invite";
  ownerId: string;
  requesterName: string;
  cartName: string;
  date: string;
  period: string;
  mode: "exchange" | "handoff";
  offeredCartName?: string;
  message?: string;
};

/** Requester update when their swap invite is accepted or declined. */
export type SwapInviteUpdatePayload = {
  type: "swap_invite_update";
  requesterId: string;
  decision: "accepted" | "declined";
  deciderName: string;
  cartName: string;
  date: string;
  period: string;
  mode: "exchange" | "handoff";
};

export type NotificationPayload =
  | IssueNotificationPayload
  | ShareInviteNotificationPayload
  | DevTestNotificationPayload
  | BookingRelocatedPayload
  | BookingCancelledPayload
  | SwapExchangePayload
  | SwapHandoffPayload
  | SwapInvitePayload
  | SwapInviteUpdatePayload;

/** Fire-and-forget from client actions. */
export function queueNotification(payload: NotificationPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  // Local: short-circuit before any API call when testing is off.
  if (!shouldQueueEmailFromClient()) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        "[notifications] skipped (local testing off)",
        payload.type,
      );
    }
    return;
  }

  const localSink = localEmailSinkForRequest();
  const body =
    localSink != null ? { ...payload, localSink } : { ...payload };

  void fetch("/api/notifications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  }).catch((err) => {
    console.error("[notifications] queue failed", err);
  });
}

/**
 * Explicit “send test email” from Settings (local only).
 * Returns the JSON response for UI feedback.
 */
export async function sendLocalTestEmail(): Promise<{
  ok: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  sent?: number;
}> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Browser only." };
  }
  if (!shouldQueueEmailFromClient()) {
    return {
      ok: false,
      error: "Turn on local testing and set a valid email first.",
    };
  }

  const localSink = localEmailSinkForRequest();
  try {
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "dev_test", localSink }),
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      skipped?: boolean;
      reason?: string;
      sent?: number;
    };
    if (!res.ok) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return {
      ok: data.ok !== false,
      error: data.error,
      skipped: data.skipped,
      reason: data.reason,
      sent: data.sent,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
