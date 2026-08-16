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
  return sealPayload("C", cartId.trim());
}

export function laptopQrPayload(code: string): string {
  return sealPayload("L", normalizeLaptopCode(code));
}

export type CubicleQrTarget =
  | { type: "cart"; cartId: string }
  | { type: "laptop"; code: string };

/** Printed Cubicle seals only. Camera apps see an opaque token. */
export function parseCubicleQrPayload(raw: string): CubicleQrTarget | null {
  const text = raw.trim();
  const sealed = parseSealedPayload(text);
  if (sealed) return sealed;

  // Labels printed before the sealed format.
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

const SEAL_PREFIX = "cbl2.";
/** App-only signing key — other scanners can read bytes, not use the label. */
const SEAL_SECRET = "cubicle.pwa.seal.v2.rbe";

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function sealMac(body: string): string {
  const first = fnv1a(`${SEAL_SECRET}\u0001${body}`);
  const second = fnv1a(`${body}\u0002${SEAL_SECRET}${first.toString(16)}`);
  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function sealPayload(kind: "C" | "L", value: string): string {
  if (!value) throw new Error("Empty Cubicle seal payload");
  const body = `${kind}.${value}`;
  return `${SEAL_PREFIX}${toBase64Url(`${body}.${sealMac(body)}`)}`;
}

function parseSealedPayload(raw: string): CubicleQrTarget | null {
  if (!raw.toLowerCase().startsWith(SEAL_PREFIX)) return null;
  const encoded = raw.slice(SEAL_PREFIX.length);
  const decoded = fromBase64Url(encoded);
  if (!decoded) return null;
  const match = /^(C|L)\.(.+)\.([0-9a-f]{16})$/.exec(decoded);
  if (!match) return null;
  const kind = match[1] as "C" | "L";
  const value = match[2];
  const mac = match[3];
  if (sealMac(`${kind}.${value}`) !== mac) return null;
  if (kind === "C") {
    const cartId = value.trim();
    return cartId ? { type: "cart", cartId } : null;
  }
  const code = normalizeLaptopCode(value);
  return isValidLaptopCode(code) ? { type: "laptop", code } : null;
}
