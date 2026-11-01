/** Rates a password. 12 or more characters with lowercase, uppercase, a digit and a symbol is "strong". 8 or more characters with a letter and a digit is "medium". Everything else is "weak". */
export function passwordStrength(password: string): "weak" | "medium" | "strong" {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  if (password.length >= 12 && hasLower && hasUpper && hasDigit && hasSymbol) return "strong";
  if (password.length >= 8 && (hasLower || hasUpper) && hasDigit) return "medium";
  return "weak";
}
