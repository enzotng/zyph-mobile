export type SplitParticipant = {
  memberId: string
  // Relative weight (number of shares). Equal split = every participant at weight 1.
  weight: number
}

export type ExpenseSplit = {
  memberId: string
  shareCents: number
}

// Divide an integer-cents amount across participants by weight, using the
// largest-remainder method so the shares always sum back to exactly `baseCents`.
export function computeSplits(baseCents: number, participants: SplitParticipant[]): ExpenseSplit[] {
  const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0)
  if (participants.length === 0 || totalWeight <= 0) {
    return participants.map((p) => ({ memberId: p.memberId, shareCents: 0 }))
  }

  const rows = participants.map((p) => {
    const exact = (baseCents * p.weight) / totalWeight
    const floor = Math.floor(exact)
    return { memberId: p.memberId, shareCents: floor, remainder: exact - floor }
  })

  // Distribute the leftover cents to the largest fractional remainders first.
  let leftover = baseCents - rows.reduce((sum, r) => sum + r.shareCents, 0)
  const byRemainder = [...rows].sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < leftover && i < byRemainder.length; i += 1) {
    byRemainder[i].shareCents += 1
  }
  leftover = 0

  return rows.map((r) => ({ memberId: r.memberId, shareCents: r.shareCents }))
}

// Reproject an existing set of splits onto a (possibly different) base amount, preserving each
// member's proportion. When `toBaseCents` equals the sum of the original shares this is the
// identity (the shares reproduce exactly), so editing an expense without touching the split keeps
// a custom split intact instead of silently re-equalising it; when the amount changed, the ratio
// is preserved and re-rounded with the same largest-remainder method.
export function rescaleSplits(initial: ExpenseSplit[], toBaseCents: number): ExpenseSplit[] {
  return computeSplits(
    toBaseCents,
    initial.map((s) => ({ memberId: s.memberId, weight: s.shareCents })),
  )
}
