/** Shared input validation for the auth screens. Run before any Supabase call. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export const MIN_PASSWORD = 8;

/**
 * Returns an error message, or null if the password (and optional confirmation) is valid.
 * Complexity mirrors the server policy (`password_requirements = "lower_upper_letters_digits"`)
 * so the client UX matches what GoTrue enforces — client checks are UX, the server is authority.
 */
export function passwordError(pw: string, confirm?: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  if (!(/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw)))
    return 'Password must include an uppercase letter, a lowercase letter, and a number.';
  if (confirm != null && pw !== confirm) return 'Passwords don’t match.';
  return null;
}
