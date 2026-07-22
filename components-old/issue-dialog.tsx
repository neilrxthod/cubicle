"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { reportIssue } from "@/lib/actions"
import { toast } from "@/hooks/use-toast"
import type { Cart } from "@/lib/types"
import { cn } from "@/lib/utils"

const SEVERITIES: Array<{ id: "low" | "medium" | "high"; label: string }> = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
]

export function IssueDialog({ cart, onClose }: { cart: Cart; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("low")

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-136 overflow-hidden rounded-2xl border border-border bg-white p-0">
        <DialogHeader className="gap-3 border-b border-border px-6 py-6 sm:px-7">
          <DialogTitle className="text-[1.45rem] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Report issue for {cart.name}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
            Share what happened so your admin can triage and resolve it quickly.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-5 px-6 py-6 sm:px-7"
          action={(formData) => {
            setError(null)
            formData.set("cartId", cart.id)
            formData.set("severity", severity)
            startTransition(async () => {
              const res = await reportIssue(formData)
              if (res && "error" in res && res.error) {
                setError(res.error)
                return
              }
              toast({ title: "Issue reported", description: `Thanks for the heads up on ${cart.name}.` })
              router.refresh()
              onClose()
            })
          }}
        >
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Severity
            </span>
            <div className="grid grid-cols-3 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSeverity(s.id)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
                    severity === s.id
                      ? "border-black bg-black text-white"
                      : "border-border bg-white text-muted-foreground hover:border-black/40 hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="description"
              className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              required
              placeholder="What happened? Which laptops? Any patterns?"
              className="min-h-28 resize-y rounded-md border border-border bg-white px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/65 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-1 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-md border border-border bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-black/40 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-10 rounded-md border border-black bg-black px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-black/90 disabled:opacity-60"
            >
              {pending ? "Submitting..." : "Send report"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
