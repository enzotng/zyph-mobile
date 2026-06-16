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

// The frozen conversion rate stored on a foreign-currency expense, as "1 USD = 0.92 EUR".
// Shows up to 4 decimals, trimming trailing zeros so "1.0000" reads "1" and "0.9200" reads "0.92".
export function formatRate(rate: number, fromCurrency: string, toCurrency: string): string {
  const formatted = rate.toFixed(4).replace(/\.?0+$/, '')
  return `1 ${fromCurrency} = ${formatted} ${toCurrency}`
}
