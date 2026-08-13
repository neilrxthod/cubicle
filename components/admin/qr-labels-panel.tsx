"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, Plus, Search, X } from "lucide-react"
import { setCartLaptopCodes } from "@/lib/actions"
import { openQrLabelsPdf, buildQrLabels } from "@/lib/export/qr-labels-pdf"
import {
  cartQrPayload,
  laptopQrPayload,
  parseLaptopCodeList,
} from "@/lib/labels/codes"
import { qrMatrix } from "@/lib/labels/qr"
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

const EMPTY_CODES: string[] = []

function QrMark({ value, className }: { value: string; className?: string }) {
  const matrix = useMemo(() => {
    if (!value) return null
    try {
      return qrMatrix(value)
    } catch {
      return null
    }
  }, [value])

  if (!matrix) {
    return (
      <div
        aria-hidden
        className={cn("rounded-[6px] bg-neutral-100", className)}
      />
    )
  }

  const dim = matrix.size + 2

  return (
    <div
      role="img"
      aria-label="QR code"
      className={cn("grid bg-white", className)}
      style={{
        gridTemplateColumns: `repeat(${dim}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${dim}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: dim * dim }, (_, index) => {
        const row = Math.floor(index / dim) - 1
        const col = (index % dim) - 1
        const on =
          row >= 0 &&
          col >= 0 &&
          row < matrix.size &&
          Boolean(matrix.dark[row]?.[col])
        return (
          <span
            key={index}
            className={on ? "bg-neutral-950" : "bg-white"}
          />
        )
      })}
    </div>
  )
}

export function QrLabelsPanel({ carts }: { carts: Cart[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [codeQuery, setCodeQuery] = useState("")
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
  const codes = selected?.laptopCodes ?? EMPTY_CODES
  const codeNeedle = codeQuery.trim().toLowerCase()
  const visibleCodes = useMemo(() => {
    if (!codeNeedle) return codes
    return codes.filter((code) => code.toLowerCase().includes(codeNeedle))
  }, [codes, codeNeedle])

  const showing: Preview =
    preview.type === "laptop" && codes.includes(preview.code)
      ? preview
      : { type: "cart" }

  const payload = selected
    ? showing.type === "laptop"
      ? laptopQrPayload(showing.code)
      : cartQrPayload(selected.id)
    : ""

  function selectCart(cart: Cart) {
    setSelectedId(cart.id)
    setDraft("")
    setCodeQuery("")
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
    setCodeQuery("")
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
        <div className="rounded-2xl border border-neutral-200/80 bg-white px-6 py-20 text-center">
          <p className="text-[17px] font-semibold tracking-[-0.02em] text-neutral-950">
            No carts
          </p>
          <p className="mt-1 text-[13px] text-neutral-400">
            Add a cart in Inventory first.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white lg:grid lg:min-h-[32rem] lg:grid-cols-[17.5rem_minmax(0,1fr)]">
          <div className="border-b border-neutral-200/80 lg:border-b-0 lg:border-r lg:bg-[#fafafa]">
            <div className="p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  className={cn(
                    "h-8 w-full rounded-[10px] border-0 bg-neutral-200/60 pl-8 pr-3",
                    "text-[13px] tracking-[-0.01em] outline-none placeholder:text-neutral-400",
                    "focus-visible:bg-neutral-200/80",
                  )}
                />
              </div>
            </div>
            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-neutral-400">
                No results
              </p>
            ) : (
              <ul className="max-h-[14rem] space-y-0.5 overflow-y-auto px-2 pb-2 lg:max-h-[28rem]">
                {visible.map((cart) => {
                  const active = cart.id === selected?.id
                  return (
                    <li key={cart.id}>
                      <button
                        type="button"
                        onClick={() => selectCart(cart)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left",
                          active ? "bg-white shadow-sm" : "hover:bg-black/[0.03]",
                        )}
                      >
                        <CartBrandMark
                          brand={cart.laptopBrand}
                          className="size-7"
                          logoClassName="size-4"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold tracking-[-0.015em] text-neutral-950">
                            {cart.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-neutral-400">
                            {cart.location || "No location"}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {selected ? (
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-1 flex-col items-center px-6 pb-6 pt-8 sm:pt-10">
                <div className="flex size-[9.5rem] items-center justify-center overflow-hidden rounded-[6px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.04]">
                  {payload ? (
                    <QrMark value={payload} className="size-full" />
                  ) : null}
                </div>

                <h3 className="mt-5 max-w-full truncate text-[21px] font-semibold tracking-[-0.03em] text-neutral-950">
                  {showing.type === "laptop" ? showing.code : selected.name}
                </h3>
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-neutral-400">
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={printing}
                      className={cn(
                        "mt-5 inline-flex h-9 items-center gap-1 rounded-full bg-neutral-950 px-5",
                        "text-[13px] font-medium text-white",
                        "transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        "hover:opacity-90 active:scale-[0.97]",
                        "data-[state=open]:opacity-90",
                        "disabled:opacity-40 disabled:active:scale-100",
                        "[&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-[cubic-bezier(0.16,1,0.3,1)]",
                        "data-[state=open]:[&_svg]:rotate-180",
                      )}
                    >
                      Print
                      <ChevronDown className="size-3.5 opacity-70" strokeWidth={2} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-44 rounded-xl p-1.5">
                    <DropdownMenuItem
                      className="cursor-pointer rounded-lg"
                      onSelect={() =>
                        printLabels(
                          [selected],
                          "carts",
                          `${selected.name} cart label`,
                        )
                      }
                    >
                      This Cart
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={codes.length === 0}
                      className="cursor-pointer rounded-lg"
                      onSelect={() =>
                        printLabels(
                          [selected],
                          "laptops",
                          `${selected.name} laptop labels`,
                        )
                      }
                    >
                      These Laptops
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="px-5 pb-5">
                <div className="overflow-hidden rounded-[14px] bg-[#f5f5f7]">
                  {codes.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-[15px] font-semibold tracking-[-0.02em] text-neutral-950">
                        No codes
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
                        Add a laptop case code like SCI-01.
                      </p>
                    </div>
                  ) : null}
                  {codes.length > 0 ? (
                    <div className="px-3 pb-2 pt-2.5">
                      <div className="relative w-44">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                        <input
                          value={codeQuery}
                          onChange={(event) => setCodeQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape" && codeQuery) {
                              event.preventDefault()
                              setCodeQuery("")
                            }
                          }}
                          placeholder="Search codes"
                          aria-label="Search laptop codes"
                          className={cn(
                            "h-8 w-full rounded-[6px] border border-neutral-200 bg-white pl-8",
                            "text-[13px] text-neutral-950 tracking-[-0.01em] outline-none",
                            "placeholder:text-neutral-500",
                            "focus-visible:border-neutral-300",
                            codeQuery ? "pr-8" : "pr-3",
                          )}
                        />
                        {codeQuery ? (
                          <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setCodeQuery("")}
                            className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-500 text-white hover:bg-neutral-700"
                          >
                            <X className="size-3" strokeWidth={2.5} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {codes.length > 0 && visibleCodes.length === 0 ? (
                    <p className="border-t border-black/[0.06] px-4 py-6 text-center text-[13px] text-neutral-400">
                      No matching codes
                    </p>
                  ) : null}
                  {visibleCodes.length > 0 ? (
                    <ul className={codes.length > 0 ? "border-t border-black/[0.06]" : undefined}>
                      {visibleCodes.map((code, index) => {
                        const active =
                          showing.type === "laptop" && showing.code === code
                        return (
                          <li
                            key={code}
                            className={cn(
                              "flex items-center",
                              index > 0 && "border-t border-black/[0.06]",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setPreview({ type: "laptop", code })
                              }
                              className={cn(
                                "flex min-w-0 flex-1 items-center px-4 py-2.5 text-left text-[15px] tracking-[-0.015em]",
                                active
                                  ? "font-medium text-neutral-950"
                                  : "text-neutral-800",
                              )}
                            >
                              {code}
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${code}`}
                              disabled={pending}
                              onClick={() => removeCode(code)}
                              className={cn(
                                "mr-2.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                                "bg-neutral-500 text-white",
                                "hover:bg-neutral-700",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/15",
                                "disabled:opacity-40",
                              )}
                            >
                              <X className="size-3.5" strokeWidth={2.5} />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                  <form
                    className="flex items-center border-t border-black/[0.06] px-3 py-1.5"
                    onSubmit={(event) => {
                      event.preventDefault()
                      addCodes()
                    }}
                  >
                    <Plus
                      className="ml-1 size-3.5 shrink-0 text-neutral-400"
                      strokeWidth={1.75}
                    />
                    <input
                      value={draft}
                      disabled={pending}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Add Code"
                      className="h-9 min-w-0 flex-1 border-0 bg-transparent px-2 text-[15px] outline-none placeholder:text-neutral-400 disabled:opacity-60"
                    />
                  </form>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
