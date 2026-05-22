import type { FxRates } from './api/fx.api'

// Cross-rate between two EUR-based ECB rates. Returns the multiplier to turn one
// unit of `from` into `to` (e.g. USD -> EUR). Throws if a currency is unknown.
export function crossRate(from: string, to: string, rates: FxRates['rates']): number {
  if (from === to) {
    return 1
  }
  const rateFrom = rates[from]
  const rateTo = rates[to]
  if (!rateFrom || !rateTo) {
    throw new Error(`Unsupported currency: ${!rateFrom ? from : to}`)
  }
  return rateTo / rateFrom
}

// Convert an integer-cents amount from one currency to another, rounded to cents.
export function convertCents(
  amountCents: number,
  from: string,
  to: string,
  rates: FxRates['rates'],
): number {
  if (from === to) {
    return amountCents
  }
  return Math.round(amountCents * crossRate(from, to, rates))
}
