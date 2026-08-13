/** Case / asset tags printed as laptop QR labels. */

export const MAX_LAPTOP_CODES_PER_CART = 200;

export function normalizeLaptopCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidLaptopCode(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{1,15}$/.test(code);
}

export function parseLaptopCodeList(raw: unknown): string[] {
  const chunks: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) chunks.push(String(item ?? ""));
  } else if (typeof raw === "string") {
    chunks.push(...raw.split(/[\s,;]+/));
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of chunks) {
    const code = normalizeLaptopCode(chunk);
    if (!isValidLaptopCode(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function cartQrPayload(cartId: string): string {
  return `CUBICLE:CART:${cartId}`;
}

export function laptopQrPayload(code: string): string {
  return `CUBICLE:LAPTOP:${normalizeLaptopCode(code)}`;
}

export type CubicleQrTarget =
  | { type: "cart"; cartId: string }
  | { type: "laptop"; code: string };

/** Read a printed Cubicle label. Anything else returns null. */
export function parseCubicleQrPayload(raw: string): CubicleQrTarget | null {
  const text = raw.trim();
  const cart = /^CUBICLE:CART:(.+)$/i.exec(text);
  if (cart?.[1]) {
    const cartId = cart[1].trim();
    if (!cartId) return null;
    return { type: "cart", cartId };
  }
  const laptop = /^CUBICLE:LAPTOP:(.+)$/i.exec(text);
  if (laptop?.[1]) {
    const code = normalizeLaptopCode(laptop[1]);
    if (!isValidLaptopCode(code)) return null;
    return { type: "laptop", code };
  }
  return null;
}
