"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, X } from "lucide-react";
import { TeacherMobileNav } from "@/components/app/teacher-mobile-nav";
import { CartBrandMark } from "@/components/admin/laptop-brand-toggle";
import { setCartLaptopCodes } from "@/lib/actions";
import { usePlatformStore } from "@/lib/data/platform-store";
import { toast } from "@/hooks/use-toast";
import { buildQrLabels, openQrLabelsPdf } from "@/lib/export/qr-labels-pdf";
import {
  cartQrPayload,
  laptopQrPayload,
  parseLaptopCodeList,
} from "@/lib/labels/codes";
import { cubicleMarkSvg } from "@/lib/labels/qr";
import {
  laptopBrandLabel,
  sortCarts,
  type Cart,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Segment = "all" | "ready" | "missing";
type Preview = { type: "cart" } | { type: "laptop"; code: string };
type PrintKind = "carts" | "laptops";

function QrMark({ value, className }: { value: string; className?: string }) {
  const svg = useMemo(() => {
    if (!value) return null;
    try {
      return cubicleMarkSvg(value);
    } catch {
      return null;
    }
  }, [value]);

  if (!svg) {
    return <div aria-hidden className={cn("rounded-[8px] bg-neutral-100", className)} />;
  }

  return (
    <div
      role="img"
      aria-label="Cubicle seal"
      className={cn("bg-white [&>svg]:block [&>svg]:size-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function MobileQrCodes({ onBack }: { onBack: () => void }) {
  const { carts } = usePlatformStore();
  const [segment, setSegment] = useState<Segment>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ordered = useMemo(() => sortCarts(carts), [carts]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordered.filter((cart) => {
      const codes = cart.laptopCodes ?? [];
      if (segment === "ready" && codes.length === 0) return false;
      if (segment === "missing" && codes.length > 0) return false;
      if (!q) return true;
      const hay = [
        cart.name,
        cart.location ?? "",
        cart.laptopBrand ?? "",
        ...codes,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [ordered, query, segment]);

  const selected = selectedId
    ? (carts.find((cart) => cart.id === selectedId) ?? null)
    : null;

  const empty =
    segment === "ready"
      ? "No carts with laptop codes"
      : segment === "missing"
        ? "Every cart has codes"
        : "No carts";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#f2f2f7] pt-[env(safe-area-inset-top,0px)]">
      <TeacherMobileNav title="QR Codes" onBack={onBack} />

      <div className="shrink-0 px-5 pb-2 pt-1">
        <div
          role="tablist"
          aria-label="QR code filter"
          className="grid grid-cols-3 rounded-[9px] bg-black/[0.06] p-0.5"
        >
          {(
            [
              { id: "all", label: "All" },
              { id: "ready", label: "Ready" },
              { id: "missing", label: "Missing" },
            ] as const
          ).map((item) => {
            const active = segment === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSegment(item.id)}
                className={cn(
                  "h-[30px] rounded-[7px] text-[13px] font-medium tracking-[-0.01em]",
                  active
                    ? "bg-white text-neutral-950 shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                    : "text-neutral-500",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <label className="mt-3 flex h-9 items-center gap-2 rounded-[10px] bg-black/[0.06] px-2.5">
          <Search className="size-4 text-neutral-400" strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-full min-w-0 flex-1 bg-transparent text-[17px] tracking-[-0.02em] text-neutral-950 outline-none placeholder:text-neutral-400"
          />
        </label>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 pt-16 text-center">
            <p className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
              {empty}
            </p>
            <p className="mt-1 text-[15px] leading-snug text-neutral-400">
              {ordered.length === 0
                ? "Add a cart in Inventory first."
                : "Carts and laptop seals will show up here."}
            </p>
          </div>
        ) : (
          <section>
            <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-[-0.01em] text-neutral-500">
              Carts
            </h2>
            <ul className="overflow-hidden rounded-[12px] bg-white">
              {visible.map((cart, index) => {
                const count = cart.laptopCodes?.length ?? 0;
                return (
                  <li
                    key={cart.id}
                    className={index > 0 ? "border-t border-neutral-100" : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(cart.id)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-neutral-50"
                    >
                      {cart.laptopBrand ? (
                        <CartBrandMark
                          brand={cart.laptopBrand}
                          className="size-9 shrink-0 rounded-full bg-neutral-100"
                          logoClassName="size-5"
                        />
                      ) : (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-500">
                          QR
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] font-semibold tracking-[-0.02em] text-neutral-950">
                          {cart.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[13px] text-neutral-400">
                          {cart.location || "No location"}
                          {cart.laptopBrand
                            ? ` · ${laptopBrandLabel(cart.laptopBrand)}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] tabular-nums text-neutral-400">
                        {count === 0
                          ? "No codes"
                          : `${count} code${count === 1 ? "" : "s"}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      {selected ? (
        <QrSheet cart={selected} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}

function QrSheet({ cart, onClose }: { cart: Cart; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview>({ type: "cart" });
  const [draft, setDraft] = useState("");
  const [printing, setPrinting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const codes = cart.laptopCodes ?? [];
  const showing: Preview =
    preview.type === "laptop" && codes.includes(preview.code)
      ? preview
      : { type: "cart" };
  const payload =
    showing.type === "laptop"
      ? laptopQrPayload(showing.code)
      : cartQrPayload(cart.id);
  const title = showing.type === "laptop" ? showing.code : cart.name;
  const subtitle =
    showing.type === "laptop"
      ? [cart.name, cart.location].filter(Boolean).join(" · ")
      : cart.location || "No location";

  function saveCodes(next: string[]) {
    startTransition(async () => {
      const res = await setCartLaptopCodes(cart.id, next);
      if (!res.ok) {
        toast({
          title: "Could not update codes",
          description: res.error,
          variant: "destructive",
        });
        return;
      }
    });
  }

  function addCodes() {
    const incoming = parseLaptopCodeList(draft);
    if (incoming.length === 0) {
      toast({
        title: "Enter a code",
        description: "Use letters, numbers, or hyphens.",
      });
      return;
    }
    const merged = parseLaptopCodeList([...codes, ...incoming]);
    if (merged.length === codes.length) {
      toast({
        title: "Already added",
        description: "Those codes are already on this cart.",
      });
      return;
    }
    setDraft("");
    saveCodes(merged);
    setPreview({ type: "laptop", code: incoming[0]! });
  }

  function removeCode(code: string) {
    const next = codes.filter((entry) => entry !== code);
    saveCodes(next);
    setRemoving(null);
    if (showing.type === "laptop" && showing.code === code) {
      setPreview(next[0] ? { type: "laptop", code: next[0] } : { type: "cart" });
    }
  }

  async function printLabels(kind: PrintKind) {
    if (kind === "laptops" && codes.length === 0) {
      toast({
        title: "Nothing to print",
        description: "Add laptop case codes first.",
      });
      return;
    }
    setPrinting(true);
    try {
      const labels = await buildQrLabels(
        [cart],
        kind,
      );
      if (labels.length === 0) {
        toast({ title: "Nothing to print", description: "No labels to print." });
        return;
      }
      const result = openQrLabelsPdf({
        heading:
          kind === "laptops"
            ? `${cart.name} laptop labels`
            : `${cart.name} cart label`,
        labels,
      });
      if (result === "blocked") {
        toast({
          title: "Popup blocked",
          description: "Allow popups to print the QR sheet.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Could not build labels",
        description: "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="absolute inset-0 z-30">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[92%] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex max-h-full flex-col overflow-hidden rounded-[14px] bg-[#f2f2f7] shadow-[0_-8px_40px_rgba(0,0,0,0.18)]">
          <div className="flex justify-center pt-2">
            <span className="h-1 w-10 rounded-full bg-neutral-300" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col items-center px-5 pb-4 pt-3">
              <div className="flex size-[9rem] items-center justify-center overflow-hidden rounded-[12px] border border-neutral-200 bg-white p-2">
                <QrMark value={payload} className="size-full" />
              </div>
              <h2 className="mt-3 max-w-full truncate text-[28px] font-semibold leading-tight tracking-[-0.04em] text-neutral-950">
                {title}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-[15px] text-neutral-500">
                <CartBrandMark
                  brand={cart.laptopBrand}
                  className="size-3.5"
                  logoClassName="size-3"
                />
                <span className="truncate">{subtitle}</span>
              </p>
              {showing.type === "laptop" ? (
                <button
                  type="button"
                  onClick={() => setPreview({ type: "cart" })}
                  className="mt-2 text-[13px] font-medium text-[#007aff]"
                >
                  Show cart seal
                </button>
              ) : null}
            </div>

            <div className="px-3 pb-2">
              <h3 className="px-1 pb-2 text-[13px] font-semibold tracking-[-0.01em] text-neutral-500">
                Laptop codes
              </h3>
              <div className="overflow-hidden rounded-[12px] bg-white">
                {codes.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[15px] text-neutral-400">
                    No codes yet
                  </p>
                ) : (
                  <ul>
                    {codes.map((code, index) => {
                      const active =
                        showing.type === "laptop" && showing.code === code;
                      return (
                        <li
                          key={code}
                          className={cn(
                            "flex items-center",
                            index > 0 && "border-t border-neutral-100",
                          )}
                        >
                          {removing === code ? (
                            <>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => setRemoving(null)}
                                className="h-11 flex-1 text-[17px] text-[#007aff] active:bg-neutral-50 disabled:opacity-40"
                              >
                                Keep
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => removeCode(code)}
                                className="h-11 flex-1 border-l border-neutral-100 text-[17px] font-semibold text-red-600 active:bg-red-50 disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreview({ type: "laptop", code })
                                }
                                className={cn(
                                  "min-w-0 flex-1 px-4 py-2.5 text-left text-[17px] tracking-[-0.02em]",
                                  active
                                    ? "font-semibold text-neutral-950"
                                    : "text-neutral-800",
                                )}
                              >
                                {code}
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove ${code}`}
                                disabled={pending}
                                onClick={() => setRemoving(code)}
                                className="mr-3 flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-400 text-white active:bg-neutral-500 disabled:opacity-40"
                              >
                                <X className="size-3.5" strokeWidth={2.5} />
                              </button>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <form
                  className="flex items-center border-t border-neutral-100 px-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addCodes();
                  }}
                >
                  <Plus
                    className="size-4 shrink-0 text-neutral-400"
                    strokeWidth={2}
                  />
                  <input
                    value={draft}
                    disabled={pending}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Add Code"
                    className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[17px] outline-none placeholder:text-neutral-400 disabled:opacity-50"
                  />
                </form>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
            <button
              type="button"
              disabled={printing}
              onClick={() => void printLabels("carts")}
              className="flex h-12 items-center justify-center rounded-[12px] bg-white text-[17px] font-medium text-[#007aff] active:bg-neutral-50 disabled:opacity-40"
            >
              {printing ? "…" : "Print Cart Label"}
            </button>
            <button
              type="button"
              disabled={printing || codes.length === 0}
              onClick={() => void printLabels("laptops")}
              className="flex h-12 items-center justify-center rounded-[12px] bg-white text-[17px] font-medium text-[#007aff] active:bg-neutral-50 disabled:opacity-40"
            >
              Print Laptop Labels
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 items-center justify-center rounded-[12px] bg-white text-[17px] font-semibold text-[#007aff] active:bg-neutral-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
