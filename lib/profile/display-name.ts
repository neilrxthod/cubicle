/**
 * Split a display name into first / last for header chips and session fields.
 * "Neil Rathod" → first Neil, last Rathod
 * "Madonna" → first Madonna only
 */
export function splitDisplayName(fullName: string): {
  firstName?: string;
  lastName?: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}
