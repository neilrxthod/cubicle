import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Cryptographically secure integer in [min, max) via Web Crypto.
 * Uses rejection sampling so results are unbiased (CodeQL-safe).
 * Works in browser and modern Node (globalThis.crypto).
 */
export function secureRandomInt(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min) {
    throw new Error("secureRandomInt: expected integers with max > min");
  }
  const range = max - min;
  const maxUint = 0x1_0000_0000;
  const limit = maxUint - (maxUint % range);
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return min + (x % range);
}
