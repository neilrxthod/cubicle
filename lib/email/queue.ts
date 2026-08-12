/**
 * Client-safe notification queue.
 * Posts to `/api/notifications` so BREVO_API_KEY never ships to the browser.
 * Failures are swallowed — never blocks booking / issue flows.
 */

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

export type NotificationPayload =
  | IssueNotificationPayload
  | ShareInviteNotificationPayload;

/** Fire-and-forget from client actions. */
export function queueNotification(payload: NotificationPayload): void {
  if (typeof window === "undefined") {
    // Should not happen for "use client" actions, but keep safe.
    return;
  }

  void fetch("/api/notifications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  }).catch((err) => {
    console.error("[notifications] queue failed", err);
  });
}
