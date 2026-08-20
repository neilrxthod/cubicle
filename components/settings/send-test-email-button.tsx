"use client";

import { useState } from "react";
import { Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { sendTestEmail } from "@/lib/email/queue";
import { cn } from "@/lib/utils";

/**
 * Delivery-test control for every signed-in staff member (desktop + phone).
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
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  async function onSend() {
    if (sending || disabled) return;
    setSending(true);
    setMessage(null);
    try {
      const result = await sendTestEmail();
      if (result.ok && (result.sent ?? 0) > 0) {
        setMessage({
          type: "ok",
          text: inboxEmail
            ? `Delivered to ${inboxEmail}`
            : "Test notification delivered.",
        });
        return;
      }
      setMessage({
        type: "error",
        text:
          result.error ||
          result.reason ||
          "Delivery failed. Try again in a moment.",
      });
    } finally {
      setSending(false);
    }
  }

  const actionLabel = sending ? "Sending" : "Send test";

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
            disabled={sending || disabled}
            aria-label="Send a test notification email"
          >
            {sending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Mail data-icon="inline-start" />
            )}
            {actionLabel}
          </Button>
        </div>
        {message ? (
          <p
            className={cn(
              "px-4 pb-3 text-[12px] leading-snug",
              message.type === "ok"
                ? "text-muted-foreground"
                : "text-destructive",
            )}
          >
            {message.text}
          </p>
        ) : null}
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
          disabled={sending || disabled}
          aria-label="Send a test notification email"
        >
          {sending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Mail data-icon="inline-start" />
          )}
          {actionLabel}
        </Button>
      </div>
      {message ? (
        <p
          className={cn(
            "flex items-start gap-1.5 text-[12.5px] leading-relaxed",
            message.type === "ok" ? "text-neutral-500" : "text-destructive",
          )}
        >
          {message.type === "ok" ? (
            <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          ) : null}
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
