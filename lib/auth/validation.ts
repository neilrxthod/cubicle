/**
 * Linear email-shape check (local@host.tld).
 * Avoids backtracking regexes on user input (CodeQL js/polynomial-redos).
 */
export function isValidEmailShape(email: string): boolean {
  const value = email.trim();
  if (value.length < 5 || value.length > 254) return false;

  const at = value.indexOf("@");
  if (at < 1 || at !== value.lastIndexOf("@")) return false;

  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  if (dot < 1 || dot >= domain.length - 1) return false;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // Same set as JS \s in the BMP ASCII range (space, tab, CR/LF, VT, FF).
    if (code <= 0x20) return false;
  }
  return true;
}

export function isSchoolEmail(email: string): boolean {
  return isValidEmailShape(email);
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password.length >= 8 && password === confirm;
}

export function passwordStrengthLabel(password: string): string {
  if (password.length === 0) return "";
  if (password.length < 8) return "8+ characters";
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Add a number and uppercase letter";
  }
  return "Strong";
}
