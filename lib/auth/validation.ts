export function isSchoolEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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
