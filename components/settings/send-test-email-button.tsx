"use client";

import { useEffect, useState } from "react";
import { CheckCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getTestEmailDelivery, sendTestEmail } from "@/lib/email/queue";
import { cn } from "@/lib/utils";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "on_the_way"; messageId?: string }
  | { kind: "delivered" }
  | { kind: "failed"; text: string };

/**
 * Delivery-test control for every signed-in staff member (desktop + phone).
 * Bouncing dots while the message is in transit; green double-check when
 * Brevo reports delivered. Status is polled live after send.
 */
export function SendTestEmailButton({
  disabled,
  appearance = "card",
  inboxEmail,
}: {
  disabled?: boolean;
  appearance?: "card" | "row";
  inboxEmail?: string;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "sending" || status.kind === "on_the_way";

  useEffect(() => {
    if (status.kind !== "on_the_way" || !status.messageId) return;
    const messageId = status.messageId;
    let cancelled = false;
    let ticks = 0;

    async function poll() {
      ticks += 1;
      const next = await getTestEmailDelivery(messageId);
      if (cancelled) return;
      if (next.phase === "delivered") {
        setStatus({ kind: "delivered" });
        return;
      }
      if (next.phase === "failed") {
        setStatus({
          kind: "failed",
          text: failedCopy(next.event, inboxEmail),
        });
      }
    }

    void poll();
    const id = window.setInterval(() => {
      if (ticks >= 45) {
        window.clearInterval(id);
        return;
      }
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [status, inboxEmail]);

  async function onSend() {
    if (busy || disabled) return;
    setStatus({ kind: "sending" });
    const result = await sendTestEmail();
    if (result.ok && (result.sent ?? 0) > 0) {
      setStatus({
        kind: "on_the_way",
        messageId: result.messageId,
      });
      return;
    }
    setStatus({
      kind: "failed",
      text:
        result.error ||
        result.reason ||
        "Delivery failed. Try again in a moment.",
    });
  }

  const actionLabel =
    status.kind === "sending"
      ? "Sending"
      : status.kind === "on_the_way"
        ? "On the way"
        : "Send test";

  const live = (
    <LiveStatus
      status={status}
      inboxEmail={inboxEmail}
      appearance={appearance}
    />
  );

  if (appearance === "row") {
    return (
      <div className="flex flex-col">
        <div className="flex min-h-[2.75rem] items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[17px] tracking-[-0.02em] text-neutral-950">
              Delivery test
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onSend()}
            disabled={busy || disabled}
            aria-label="Send a test notification email"
          >
            {status.kind === "sending" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Mail data-icon="inline-start" />
            )}
            {actionLabel}
          </Button>
        </div>
        {live}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium tracking-[-0.01em] text-neutral-900">
            Delivery test
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">
            Send a sample Cubicle notification to your school inbox.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void onSend()}
          disabled={busy || disabled}
          aria-label="Send a test notification email"
        >
          {status.kind === "sending" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Mail data-icon="inline-start" />
          )}
          {actionLabel}
        </Button>
      </div>
      {live}
    </div>
  );
}

function LiveStatus({
  status,
  inboxEmail,
  appearance,
}: {
  status: Status;
  inboxEmail?: string;
  appearance: "card" | "row";
}) {
  if (status.kind === "idle") return null;

  const to = inboxEmail ? ` to ${inboxEmail}` : "";
  const pad = appearance === "row" ? "px-4 pb-3" : "";

  if (status.kind === "sending" || status.kind === "on_the_way") {
    return (
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-2 text-[12.5px] leading-relaxed text-amber-600",
          pad,
        )}
      >
        <BouncingDots />
        {status.kind === "sending" ? "Sending" : `On the way${to}`}
      </p>
    );
  }

  if (status.kind === "delivered") {
    return (
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 text-[12.5px] font-medium leading-relaxed text-emerald-700",
          pad,
        )}
      >
        <CheckCheck
          className="size-4 shrink-0 text-emerald-600"
          strokeWidth={2.25}
          aria-hidden
        />
        Delivered{to}
      </p>
    );
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("text-[12.5px] leading-relaxed text-destructive", pad)}
    >
      {status.text}
    </p>
  );
}

function failedCopy(event: string | undefined, inboxEmail?: string): string {
  if (event === "spam") {
    return inboxEmail
      ? `The provider marked this as spam. Check junk for ${inboxEmail}.`
      : "The provider marked this as spam. Check your junk folder.";
  }
  if (event === "hardBounce" || event === "invalid") {
    return "The address was rejected. Confirm the school email on this account.";
  }
  if (event === "blocked") {
    return "The provider blocked this send. Try again in a moment.";
  }
  return "Delivery failed. Try again in a moment.";
}

function BouncingDots() {
  return (
    <span className="email-test-loader" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
