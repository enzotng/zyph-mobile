// Money formatting shared across features and UI primitives.
export function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`
}

// Like formatAmount but always shows an explicit sign for positive values
// (negative amounts already carry "-"): "+12.00 EUR" / "-8.50 EUR" / "0.00 EUR".
export function signedAmount(cents: number, currency: string): string {
  const sign = cents > 0 ? '+' : ''
  return `${sign}${formatAmount(cents, currency)}`
}
