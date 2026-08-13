"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Printer, Search, X } from "lucide-react"
import { setCartLaptopCodes } from "@/lib/actions"
import { openQrLabelsPdf, buildQrLabels } from "@/lib/export/qr-labels-pdf"
import {
  cartQrPayload,
  laptopQrPayload,
  parseLaptopCodeList,
} from "@/lib/labels/codes"
import { qrDataUrl } from "@/lib/labels/qr"
import {
  laptopBrandLabel,
  sortCarts,
  type Cart,
} from "@/lib/types"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { CartBrandMark } from "@/components/admin/laptop-brand-toggle"

type PrintKind = "all" | "carts" | "laptops"

function QrMark({ value, className }: { value: string; className?: string }) {
  const [src, setSrc] = useState("")

  useEffect(() => {
    let live = true
    qrDataUrl(value).then((url) => {
      if (live) setSrc(url)
    })
    return () => {
      live = false
    }
  }, [value])

  if (!src) {
    return (
      <div
        aria-hidden
        className={cn("animate-pulse rounded-sm bg-neutral-100", className)}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" draggable={false} className={className} />
  )
}

export function QrLabelsPanel({ carts }: { carts: Cart[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<PrintKind>("all")
  const [draftByCart, setDraftByCart] = useState<Record<string, string>>({})
  const [printing, setPrinting] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const ordered = useMemo(() => sortCarts(carts), [carts])
  const q = query.trim().toLowerCase()
  const visible = useMemo(() => {
    if (!q) return ordered
    return ordered.filter((cart) => {
      const hay = [
        cart.name,
        cart.location ?? "",
        cart.laptopBrand ?? "",
        ...(cart.laptopCodes ?? []),
      ]
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [ordered, q])

  const laptopTotal = visible.reduce(
    (sum, cart) => sum + (cart.laptopCodes?.length ?? 0),
    0,
  )
  const showCartQr = kind !== "laptops"
  const showLaptops = kind !== "carts"

  async function printLabels(source: Cart[], printKind: PrintKind, heading: string) {
    if (source.length === 0) {
      toast({ title: "Nothing to print", description: "Add a cart first." })
      return
    }
    setPrinting(true)
    try {
      const labels = await buildQrLabels(source, printKind)
      if (labels.length === 0) {
        toast({
          title: "Nothing to print",
          description:
            printKind === "laptops"
              ? "Add laptop case codes first."
              : "No labels match this filter.",
        })
        return
      }
      const result = openQrLabelsPdf({ heading, labels })
      if (result === "blocked") {
        toast({
          title: "Popup blocked",
          description: "Allow popups to print the QR sheet.",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Could not build labels",
        description: "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setPrinting(false)
    }
  }

  function saveCodes(cart: Cart, next: string[]) {
    setPendingId(cart.id)
    startTransition(async () => {
      const res = await setCartLaptopCodes(cart.id, next)
      setPendingId(null)
      if (!res.ok) {
        toast({
          title: "Could not update codes",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      router.refresh()
    })
  }

  function addCodes(cart: Cart) {
    const raw = draftByCart[cart.id] ?? ""
    const incoming = parseLaptopCodeList(raw)
    if (incoming.length === 0) {
      toast({
        title: "Enter a code",
        description: "Use letters, numbers, or hyphens. Paste several at once.",
      })
      return
    }
    const existing = cart.laptopCodes ?? []
    const merged = parseLaptopCodeList([...existing, ...incoming])
    if (merged.length === existing.length) {
      toast({
        title: "Already added",
        description: "Those codes are already on this cart.",
      })
      return
    }
    setDraftByCart((prev) => ({ ...prev, [cart.id]: "" }))
    saveCodes(cart, merged)
  }

  function removeCode(cart: Cart, code: string) {
    saveCodes(
      cart,
      (cart.laptopCodes ?? []).filter((entry) => entry !== code),
    )
  }

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[15px] font-light tracking-[-0.03em] text-neutral-950">
            QR codes
          </h2>
          <p className="mt-1 text-[12.5px] tracking-[-0.01em] text-neutral-400">
            One label per cart, one per laptop case. Print a letter sheet as PDF.
          </p>
        </div>
        <button
          type="button"
          disabled={printing || visible.length === 0}
          onClick={() =>
            printLabels(visible, kind, kind === "carts"
              ? "Cart labels"
              : kind === "laptops"
                ? "Laptop labels"
                : "Cart and laptop labels")
          }
          className={cn(
            "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-neutral-950 px-3",
            "text-[12.5px] font-medium tracking-[-0.01em] text-white",
            "transition-opacity hover:opacity-90 disabled:opacity-40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15",
          )}
        >
          {printing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Printer className="size-3.5" strokeWidth={1.75} />
          )}
          Print PDF
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cart or code"
            className={cn(
              "h-8 w-full rounded-md border border-[var(--hairline-strong)] bg-white pl-8 pr-2.5",
              "text-[12.5px] tracking-[-0.01em] text-neutral-950 outline-none",
              "placeholder:text-neutral-300",
              "focus-visible:border-neutral-400",
            )}
          />
        </div>
        <div className="inline-flex h-8 items-center rounded-md border border-[var(--hairline-strong)] bg-white p-0.5">
          {(
            [
              ["all", "All"],
              ["carts", "Carts"],
              ["laptops", "Laptops"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
              className={cn(
                "h-7 rounded-[5px] px-2.5 text-[12px] font-medium tracking-[-0.01em]",
                kind === id
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[12.5px] tabular-nums tracking-[-0.01em] text-neutral-400">
        {kind !== "laptops" ? (
          <>
            <span className="font-medium text-neutral-950">{visible.length}</span>{" "}
            cart{visible.length === 1 ? "" : "s"}
          </>
        ) : null}
        {kind === "all" ? (
          <span className="mx-1.5 text-neutral-300">·</span>
        ) : null}
        {kind !== "carts" ? (
          <>
            <span className="font-medium text-neutral-950">{laptopTotal}</span>{" "}
            laptop{laptopTotal === 1 ? "" : "s"}
          </>
        ) : null}
      </p>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-200/80 bg-white px-6 py-16 text-center">
          <p className="text-[13.5px] font-medium tracking-[-0.015em] text-neutral-950">
            {ordered.length === 0 ? "No carts in inventory" : "No matching carts"}
          </p>
          <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-neutral-400">
            {ordered.length === 0
              ? "Add carts in Inventory, then return here to print labels."
              : "Try a different cart name or laptop code."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((cart) => {
            const codes = cart.laptopCodes ?? []
            const pending = pendingId === cart.id
            const draft = draftByCart[cart.id] ?? ""
            return (
              <article
                key={cart.id}
                className="rounded-xl border border-[var(--hairline-strong)] bg-white p-4 shadow-[var(--shadow-surface)] sm:p-5"
              >
                <div className="flex items-start gap-4">
                  {showCartQr ? (
                    <div className="flex size-[4.5rem] shrink-0 items-center justify-center rounded-lg border border-neutral-200/80 bg-white p-1.5">
                      <QrMark
                        value={cartQrPayload(cart.id)}
                        className="size-full"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <CartBrandMark
                            brand={cart.laptopBrand}
                            className="size-5"
                            logoClassName="size-4"
                          />
                          <h3 className="truncate text-[13.5px] font-medium tracking-[-0.02em] text-neutral-950">
                            {cart.name}
                          </h3>
                        </div>
                        <p className="mt-1 truncate text-[12px] tracking-[-0.01em] text-neutral-400">
                          Cart
                          {cart.location ? ` · ${cart.location}` : ""}
                          {cart.laptopBrand
                            ? ` · ${laptopBrandLabel(cart.laptopBrand)}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={printing}
                        onClick={() =>
                          printLabels(
                            [cart],
                            kind,
                            kind === "carts"
                              ? `${cart.name} cart label`
                              : kind === "laptops"
                                ? `${cart.name} laptop labels`
                                : `${cart.name} labels`,
                          )
                        }
                        className={cn(
                          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5",
                          "text-[12px] font-medium tracking-[-0.01em] text-neutral-600",
                          "hover:bg-neutral-50 hover:text-neutral-950",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/10",
                          "disabled:opacity-40",
                        )}
                      >
                        <Printer className="size-3.5" strokeWidth={1.75} />
                        Print
                      </button>
                    </div>
                  </div>
                </div>

                {showLaptops ? (
                <div className={cn(showCartQr && "mt-4 border-t border-[var(--hairline)] pt-4")}>
                  <div className="mb-2.5 flex items-baseline justify-between gap-3">
                    <p className="text-[11px] font-medium tracking-[0.04em] text-neutral-400">
                      Laptop cases
                    </p>
                    <p className="text-[11.5px] tabular-nums text-neutral-400">
                      {codes.length}
                    </p>
                  </div>

                  {codes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {codes.map((code) => (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-neutral-50/80 py-0.5 pl-2 pr-0.5"
                        >
                          <span className="font-mono text-[11.5px] tracking-[-0.01em] text-neutral-800">
                            {code}
                          </span>
                          <button
                            type="button"
                            aria-label={`Remove ${code}`}
                            disabled={pending}
                            onClick={() => removeCode(cart, code)}
                            className="flex size-5 items-center justify-center rounded text-neutral-400 hover:bg-white hover:text-neutral-800 disabled:opacity-40"
                          >
                            <X className="size-3" strokeWidth={1.75} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-neutral-400">
                      No case codes yet. Add the alphanumeric tags on the laptops.
                    </p>
                  )}

                  {codes.length > 0 ? (
                    <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                      {codes.map((code) => (
                        <div
                          key={`${cart.id}-${code}`}
                          className="flex flex-col items-center gap-1.5 rounded-lg border border-neutral-200/70 bg-white px-1.5 py-2"
                        >
                          <QrMark
                            value={laptopQrPayload(code)}
                            className="size-12"
                          />
                          <span className="w-full truncate text-center font-mono text-[10px] tracking-[-0.02em] text-neutral-600">
                            {code}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <form
                    className="mt-3 flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      addCodes(cart)
                    }}
                  >
                    <input
                      value={draft}
                      disabled={pending}
                      onChange={(event) =>
                        setDraftByCart((prev) => ({
                          ...prev,
                          [cart.id]: event.target.value,
                        }))
                      }
                      placeholder="LIB-05 or paste several"
                      className={cn(
                        "h-8 min-w-0 flex-1 rounded-md border border-neutral-200 bg-white px-2.5",
                        "text-[12.5px] tracking-[-0.01em] text-neutral-950 outline-none",
                        "placeholder:text-neutral-300",
                        "focus-visible:border-neutral-400",
                        "disabled:opacity-60",
                      )}
                    />
                    <button
                      type="submit"
                      disabled={pending || !draft.trim()}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5",
                        "text-[12.5px] font-medium text-neutral-700",
                        "hover:bg-neutral-50 hover:text-neutral-950",
                        "disabled:opacity-40",
                      )}
                    >
                      {pending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" strokeWidth={1.75} />
                      )}
                      Add
                    </button>
                  </form>
                </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
