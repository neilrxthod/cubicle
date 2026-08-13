"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Loader2, Plus, Printer, Search, X } from "lucide-react"
import { setCartLaptopCodes } from "@/lib/actions"
import { openQrLabelsPdf, buildQrLabels } from "@/lib/export/qr-labels-pdf"
import {
  cartQrPayload,
  laptopQrPayload,
  parseLaptopCodeList,
} from "@/lib/labels/codes"
import { qrDataUrl } from "@/lib/labels/qr"
import { sortCarts, type Cart } from "@/lib/types"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { CartBrandMark } from "@/components/admin/laptop-brand-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type PrintKind = "all" | "carts" | "laptops"
type Preview = { type: "cart" } | { type: "laptop"; code: string }

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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview>({ type: "cart" })
  const [draft, setDraft] = useState("")
  const [printing, setPrinting] = useState(false)
  const [pending, startTransition] = useTransition()

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

  const selected =
    visible.find((cart) => cart.id === selectedId) ?? visible[0] ?? null
  const codes = selected?.laptopCodes ?? []

  const showing: Preview =
    preview.type === "laptop" && codes.includes(preview.code)
      ? preview
      : { type: "cart" }

  const payload = selected
    ? showing.type === "laptop"
      ? laptopQrPayload(showing.code)
      : cartQrPayload(selected.id)
    : ""

  const laptopTotal = ordered.reduce(
    (sum, cart) => sum + (cart.laptopCodes?.length ?? 0),
    0,
  )

  function selectCart(cart: Cart) {
    setSelectedId(cart.id)
    setDraft("")
    setPreview({ type: "cart" })
  }

  async function printLabels(
    source: Cart[],
    printKind: PrintKind,
    heading: string,
  ) {
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
              : "No labels to print.",
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
    startTransition(async () => {
      const res = await setCartLaptopCodes(cart.id, next)
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

  function addCodes() {
    if (!selected) return
    const incoming = parseLaptopCodeList(draft)
    if (incoming.length === 0) {
      toast({
        title: "Enter a code",
        description: "Use letters, numbers, or hyphens. Paste several at once.",
      })
      return
    }
    const merged = parseLaptopCodeList([...codes, ...incoming])
    if (merged.length === codes.length) {
      toast({
        title: "Already added",
        description: "Those codes are already on this cart.",
      })
      return
    }
    setDraft("")
    saveCodes(selected, merged)
    setPreview({ type: "laptop", code: incoming[0]! })
  }

  function removeCode(code: string) {
    if (!selected) return
    const next = codes.filter((entry) => entry !== code)
    saveCodes(selected, next)
    if (showing.type === "laptop" && showing.code === code) {
      setPreview(next[0] ? { type: "laptop", code: next[0] } : { type: "cart" })
    }
  }

  return (
    <section className="min-w-0">
      {ordered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200/80 bg-white px-6 py-16 text-center">
          <p className="text-[13.5px] font-medium tracking-[-0.015em] text-neutral-950">
            No carts in inventory
          </p>
          <p className="mt-1.5 text-[12.5px] text-neutral-400">
            Add carts in Inventory, then return here to print labels.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-white shadow-[var(--shadow-surface)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hairline)] px-3 py-2 sm:px-4">
            <p className="shrink-0 text-[12.5px] text-neutral-400">
              Carts{" "}
              <span className="tabular-nums text-neutral-950">{visible.length}</span>
            </p>
            <div className="relative min-w-0 flex-1 sm:max-w-[14rem]">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className={cn(
                  "h-8 w-full rounded-md border border-neutral-200 bg-white pl-7 pr-2.5",
                  "text-[12.5px] tracking-[-0.01em] outline-none placeholder:text-neutral-300",
                  "focus-visible:border-neutral-400",
                )}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={printing}
                  className={cn(
                    "ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-neutral-950 px-3",
                    "text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-40",
                  )}
                >
                  {printing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Printer className="size-3.5" strokeWidth={1.75} />
                  )}
                  Print
                  <ChevronDown className="size-3.5 opacity-70" strokeWidth={1.75} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
                <DropdownMenuItem
                  className="cursor-pointer rounded-lg"
                  onSelect={() => printLabels(ordered, "carts", "Cart labels")}
                >
                  All cart labels
                  <span className="ml-auto tabular-nums text-[11px] text-neutral-400">
                    {ordered.length}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={laptopTotal === 0}
                  className="cursor-pointer rounded-lg"
                  onSelect={() => printLabels(ordered, "laptops", "Laptop labels")}
                >
                  All laptop labels
                  <span className="ml-auto tabular-nums text-[11px] text-neutral-400">
                    {laptopTotal}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {visible.length === 0 ? (
            <p className="px-5 py-14 text-center text-[13px] text-neutral-400">
              No matching carts.
            </p>
          ) : (
            <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
              <div className="border-b border-[var(--hairline)] lg:border-b-0 lg:border-r">
                <ul className="max-h-[14rem] overflow-y-auto lg:max-h-[28rem]">
                  {visible.map((cart) => {
                    const active = cart.id === selected?.id
                    return (
                      <li key={cart.id}>
                        <button
                          type="button"
                          onClick={() => selectCart(cart)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left",
                            "border-b border-[var(--hairline)] last:border-b-0",
                            active ? "bg-neutral-50" : "hover:bg-neutral-50/70",
                          )}
                        >
                          <CartBrandMark
                            brand={cart.laptopBrand}
                            className="size-5"
                            logoClassName="size-3.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium tracking-[-0.02em] text-neutral-950">
                              {cart.name}
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-neutral-400">
                              {cart.location || "No location"}
                            </span>
                          </span>
                          <span className="shrink-0 text-[12px] tabular-nums text-neutral-400">
                            {cart.laptopCodes?.length ?? 0}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {selected ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-md border border-neutral-200 p-1.5">
                      {payload ? (
                        <QrMark value={payload} className="size-full" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[13.5px] font-medium tracking-[-0.02em] text-neutral-950">
                        {showing.type === "laptop" ? showing.code : selected.name}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-neutral-400">
                        <CartBrandMark
                          brand={selected.laptopBrand}
                          className="size-3.5"
                          logoClassName="size-3"
                        />
                        <span className="truncate">
                          {showing.type === "laptop"
                            ? [selected.name, selected.location]
                                .filter(Boolean)
                                .join(" · ")
                            : selected.location || "No location"}
                        </span>
                      </p>
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          disabled={printing}
                          onClick={() =>
                            printLabels(
                              [selected],
                              "carts",
                              `${selected.name} cart label`,
                            )
                          }
                          className="h-8 rounded-md bg-neutral-950 px-3 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-40"
                        >
                          Print cart
                        </button>
                        <button
                          type="button"
                          disabled={printing || codes.length === 0}
                          onClick={() =>
                            printLabels(
                              [selected],
                              "laptops",
                              `${selected.name} laptop labels`,
                            )
                          }
                          className="h-8 rounded-md border border-neutral-200 px-3 text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                        >
                          Print laptops
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[var(--hairline)]">
                    {codes.length > 0 ? (
                      <table className="w-full table-fixed border-collapse text-left">
                        <colgroup>
                          <col className="w-12" />
                          <col />
                          <col className="w-10" />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-[var(--hairline)]">
                            <th className="px-4 py-2 text-[11.5px] font-medium text-neutral-400 sm:px-5">
                              #
                            </th>
                            <th className="px-3 py-2 text-[11.5px] font-medium text-neutral-400">
                              Code
                            </th>
                            <th aria-label="Remove" />
                          </tr>
                        </thead>
                        <tbody>
                          {codes.map((code, index) => {
                            const active =
                              showing.type === "laptop" && showing.code === code
                            return (
                              <tr
                                key={code}
                                onClick={() =>
                                  setPreview({ type: "laptop", code })
                                }
                                className={cn(
                                  "cursor-pointer border-t border-[var(--hairline)] first:border-t-0",
                                  active
                                    ? "bg-neutral-50"
                                    : "hover:bg-neutral-50/60",
                                )}
                              >
                                <td className="px-4 py-2.5 text-[12.5px] tabular-nums text-neutral-400 sm:px-5">
                                  {index + 1}
                                </td>
                                <td className="px-3 py-2.5 text-[13px] tracking-[-0.015em] text-neutral-950">
                                  {code}
                                </td>
                                <td className="pr-2">
                                  <button
                                    type="button"
                                    aria-label={`Remove ${code}`}
                                    disabled={pending}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      removeCode(code)
                                    }}
                                    className="flex size-7 items-center justify-center rounded-md text-neutral-300 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-40"
                                  >
                                    <X className="size-3.5" strokeWidth={1.75} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="px-5 py-6 text-[12.5px] text-neutral-400">
                        No laptop codes yet.
                      </p>
                    )}

                    <form
                      className="flex items-center gap-2 border-t border-[var(--hairline)] px-4 py-2.5 sm:px-5"
                      onSubmit={(event) => {
                        event.preventDefault()
                        addCodes()
                      }}
                    >
                      <input
                        value={draft}
                        disabled={pending}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Add code"
                        className={cn(
                          "h-8 w-40 rounded-md border border-neutral-200 px-2.5",
                          "text-[12.5px] outline-none placeholder:text-neutral-300",
                          "focus-visible:border-neutral-400 disabled:opacity-60",
                        )}
                      />
                      <button
                        type="submit"
                        disabled={pending || !draft.trim()}
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-neutral-950 px-2.5 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-40"
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
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
