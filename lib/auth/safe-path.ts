/**
 * Same-origin relative paths only. `startsWith("/")` is not enough:
 * `//evil.com` is protocol-relative and would leave the app after OAuth.
 */
export function isSafeInternalPath(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  if (value.length > 512) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  if (value.includes("\\") || value.includes("://")) return false;

  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value) {
      if (
        decoded.startsWith("//") ||
        decoded.startsWith("/\\") ||
        decoded.includes("\\") ||
        decoded.includes("://")
      ) {
        return false;
      }
    }
  } catch {
    return false;
  }

  return true;
}
