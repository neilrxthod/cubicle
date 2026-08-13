/**
 * Phones and tablets that report as iOS or Android.
 * iPadOS 13+ Safari uses a Macintosh UA — touch points distinguish it.
 */
export function isIosOrAndroidUserAgent(
  userAgent: string,
  maxTouchPoints = 0,
): boolean {
  if (/Android/i.test(userAgent)) return true;
  if (/iPhone|iPod|iPad/i.test(userAgent)) return true;
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return true;
  return false;
}

export function isIosOrAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIosOrAndroidUserAgent(
    navigator.userAgent,
    navigator.maxTouchPoints ?? 0,
  );
}
