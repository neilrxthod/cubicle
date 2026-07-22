"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reportIssue } from "@/lib/actions";
import { toast } from "@/hooks/use-toast";
import type { Cart } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEVERITIES: Array<{
  id: "low" | "medium" | "high";
  label: string;
}> = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export function IssueDialog({
  cart,
  carts,
  onClose,
}: {
  cart?: Cart | null;
  carts?: Cart[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [cartId, setCartId] = useState(cart?.id ?? carts?.[0]?.id ?? "");

  const selectedCart =
    cart ?? carts?.find((entry) => entry.id === cartId) ?? null;
  const canPickCart = !cart && Boolean(carts?.length);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border/60 bg-white p-0 shadow-xl sm:max-w-[400px]">
        <DialogHeader className="space-y-1.5 border-b border-border/60 px-5 py-5 text-left sm:px-6">
          <DialogTitle>Report issue</DialogTitle>
          <DialogDescription>
            High severity pauses the cart for maintenance.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-5 px-5 py-5 sm:px-6"
          action={(formData) => {
            setError(null);
            const id = cart?.id ?? cartId;
            if (!id) {
              setError("Select a cart.");
              return;
            }
            formData.set("cartId", id);
            formData.set("severity", severity);
            startTransition(async () => {
              const res = await reportIssue(formData);
              if (res && "error" in res && res.error) {
                setError(res.error);
                return;
              }
              toast({
                title: "Reported",
                description: selectedCart
                  ? `${selectedCart.name} · sent to admin`
                  : "Sent to admin",
              });
              router.refresh();
              onClose();
            });
          }}
        >
          {canPickCart ? (
            <label className="block space-y-1.5">
              <span className="type-label">Cart</span>
              <select
                value={cartId}
                onChange={(e) => setCartId(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-white px-3 text-[14px] tracking-[-0.011em] text-foreground outline-none focus:border-neutral-400"
              >
                {carts?.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                    {entry.location ? ` · ${entry.location}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : selectedCart ? (
            <div className="rounded-xl border border-border/60 bg-muted/10 px-3.5 py-3">
              <p className="type-label">Cart</p>
              <p className="type-body-strong mt-1">{selectedCart.name}</p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <p className="type-label">Severity</p>
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/40 p-1">
              {SEVERITIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSeverity(s.id)}
                  className={cn(
                    "h-8 rounded-lg text-[13px] font-medium tracking-[-0.011em] transition-all",
                    severity === s.id
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="type-label">Description</span>
            <textarea
              name="description"
              rows={4}
              required
              placeholder="What happened?"
              className="min-h-[104px] w-full resize-none rounded-xl border border-border bg-white px-3.5 py-3 text-[14px] leading-relaxed tracking-[-0.011em] text-foreground outline-none placeholder:text-muted-foreground focus:border-neutral-400"
            />
          </label>

          {error ? <p className="type-body text-red-600">{error}</p> : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !(cart?.id ?? cartId)}
              className="h-9 rounded-full bg-foreground px-5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {pending ? "Sending…" : "Submit"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
