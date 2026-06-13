import { computeSplits, type ExpenseSplit } from './splits'

export const SPLIT_MODES = ['equal', 'shares', 'exact', 'percent'] as const
export type SplitMode = (typeof SPLIT_MODES)[number]

// 1% expressed in hundredths, so a percentage becomes an integer weight for the largest-remainder
// split (33.33% -> 3333). Keeps percent rounding exact and float-free.
const PERCENT_SCALE = 100

export type ExactEntry = { memberId: string; cents: number }
export type PercentEntry = { memberId: string; percent: number }

export type SumCheck = {
  allocatedCents: number
  // Signed: positive = under-allocated (cents still to assign), negative = over-allocated.
  remainderCents: number
  isBalanced: boolean
}

// Parse a trip-currency amount string ("12,50" / "12.5" / "12.") to integer cents. Total and never
// throws: empty or malformed input yields 0. Like AMOUNT_RE but tolerant of a trailing separator
// ("12." -> 1200) so the share preview updates mid-typing; comma accepted for FR.
export function parseCentsInput(raw: string | undefined): number {
  if (!raw) {
    return 0
  }
  const s = raw.trim()
  if (!/^\d+([.,]\d{0,2})?$/.test(s)) {
    return 0
  }
  const [int = '0', dec = ''] = s.replace(',', '.').split('.')
  return Number.parseInt(int, 10) * 100 + Number.parseInt(dec.padEnd(2, '0').slice(0, 2) || '0', 10)
}

// Parse a percentage string to a float >= 0; empty/invalid/negative -> 0. Values above 100 are
// allowed so the banner can surface an over-allocation.
export function parsePercentInput(raw: string | undefined): number {
  if (!raw) {
    return 0
  }
  const v = Number.parseFloat(raw.trim().replace(',', '.'))
  return Number.isFinite(v) && v >= 0 ? v : 0
}

// EXACT: each member's cents are taken verbatim (never redistributed). Clamped non-negative.
export function exactToSplits(entries: readonly ExactEntry[]): ExpenseSplit[] {
  return entries.map((e) => ({
    memberId: e.memberId,
    shareCents: Math.max(0, Math.round(e.cents)),
  }))
}

// PERCENT: routed through the largest-remainder split so the cents always sum to baseCents when
// the percentages sum to 100.
export function percentToSplits(
  entries: readonly PercentEntry[],
  baseCents: number,
): ExpenseSplit[] {
  return computeSplits(
    baseCents,
    entries.map((e) => ({ memberId: e.memberId, weight: Math.round(e.percent * PERCENT_SCALE) })),
  )
}

export function validateExactSum(entries: readonly ExactEntry[], baseCents: number): SumCheck {
  const allocatedCents = entries.reduce((s, e) => s + Math.max(0, Math.round(e.cents)), 0)
  const remainderCents = baseCents - allocatedCents
  return { allocatedCents, remainderCents, isBalanced: remainderCents === 0 }
}

// Validity is decided on the percentage sum (in integer hundredths to avoid float drift: 33.33 x 3
// = 9999, not 10000). allocatedCents/remainderCents come from the snapped split for the banner.
export function validatePercentSum(entries: readonly PercentEntry[], baseCents: number): SumCheck {
  const totalHundredths = entries.reduce((s, e) => s + Math.round(e.percent * PERCENT_SCALE), 0)
  const allocatedCents = percentToSplits(entries, baseCents).reduce((s, x) => s + x.shareCents, 0)
  return {
    allocatedCents,
    remainderCents: baseCents - allocatedCents,
    isBalanced: totalHundredths === 100 * PERCENT_SCALE,
  }
}

// Convert a cents split back to percentages for prefilling the percent inputs on a mode switch.
// The rounding residual is biased onto the largest share so the displayed percentages sum to 100.
export function centsToPercent(shares: readonly ExpenseSplit[], baseCents: number): PercentEntry[] {
  if (baseCents <= 0) {
    return shares.map((s) => ({ memberId: s.memberId, percent: 0 }))
  }
  const raw = shares.map((s) => ({
    memberId: s.memberId,
    percent: Math.round((s.shareCents / baseCents) * 10000) / 100,
  }))
  const residual = Math.round((100 - raw.reduce((sum, r) => sum + r.percent, 0)) * 100) / 100
  if (raw.length > 0 && Math.abs(residual) >= 0.01) {
    const idx = raw.reduce((best, r, i) => (r.percent > raw[best].percent ? i : best), 0)
    raw[idx] = { ...raw[idx], percent: Math.round((raw[idx].percent + residual) * 100) / 100 }
  }
  return raw
}
