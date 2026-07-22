/**
 * Only school board Google accounts may use Cubicle.
 * Even @rbe.sk.ca must also appear on the allowlist.
 */
export const SCHOOL_EMAIL_DOMAIN = "rbe.sk.ca";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True if email is exactly someone@rbe.sk.ca (no subdomains). */
export function isSchoolEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return false;
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return false;
  // Reject user@evil.rbe.sk.ca and user@rbe.sk.ca.evil.com
  return domain === SCHOOL_EMAIL_DOMAIN;
}

export function schoolEmailError(email: string): string | null {
  if (!email.trim()) return "Email is required.";
  if (!isSchoolEmail(email)) {
    return `Only @${SCHOOL_EMAIL_DOMAIN} Google accounts can access Cubicle. Personal Gmail and other domains are not allowed.`;
  }
  return null;
}

/** Google OAuth hosted-domain hint (Workspace). Not a security boundary alone. */
export const GOOGLE_HOSTED_DOMAIN = SCHOOL_EMAIL_DOMAIN;
