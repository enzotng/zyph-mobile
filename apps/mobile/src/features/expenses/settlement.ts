import { formatAmount } from '@/lib/money'

export type MemberBalance = {
  memberId: string
  // Net balance in integer cents: positive = owed to them, negative = they owe.
  balanceCents: number
}

export type Settlement = {
  fromMemberId: string
  toMemberId: string
  amountCents: number
}

// Greedy debt simplification: repeatedly settle the largest debtor against the
// largest creditor. Produces at most n-1 transfers for n members and works on
// integer cents so amounts always reconcile exactly.
export function settleBalances(balances: MemberBalance[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ memberId: b.memberId, amount: -b.balanceCents }))
    .sort((a, b) => b.amount - a.amount)
  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ memberId: b.memberId, amount: b.balanceCents }))
    .sort((a, b) => b.amount - a.amount)

  const settlements: Settlement[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.min(debtor.amount, creditor.amount)
    if (amount > 0) {
      settlements.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountCents: amount,
      })
    }
    debtor.amount -= amount
    creditor.amount -= amount
    if (debtor.amount === 0) {
      i += 1
    }
    if (creditor.amount === 0) {
      j += 1
    }
  }
  return settlements
}

export type PairwiseEntry = { memberId: string; amountCents: number }
export type PairwiseBalance = { owes: PairwiseEntry[]; owedBy: PairwiseEntry[] }

// Group the minimised settlement set by member so each person can see, in both directions, who
// they should pay (`owes`) and who should pay them (`owedBy`) - the per-person view of the same
// suggested transfers.
export function pairwiseBalances(settlements: Settlement[]): Map<string, PairwiseBalance> {
  const byMember = new Map<string, PairwiseBalance>()
  const entryFor = (memberId: string): PairwiseBalance => {
    const existing = byMember.get(memberId)
    if (existing) {
      return existing
    }
    const created: PairwiseBalance = { owes: [], owedBy: [] }
    byMember.set(memberId, created)
    return created
  }
  for (const s of settlements) {
    entryFor(s.fromMemberId).owes.push({ memberId: s.toMemberId, amountCents: s.amountCents })
    entryFor(s.toMemberId).owedBy.push({ memberId: s.fromMemberId, amountCents: s.amountCents })
  }
  return byMember
}

// One "who pays whom" row of a shareable settle-up plan, with names pre-resolved by the caller.
export type SettleUpLine = { from: string; to: string; amountCents: number }

// Build the plain-text settle-up summary shared through the native share sheet. The caller
// resolves real display names (never "You", since the recipient would not know who that is) and
// the currency, so this stays a pure, testable string builder.
export function formatSettleUpSummary(input: {
  title: string
  lines: SettleUpLine[]
  currency: string
  settledLabel: string
}): string {
  const { title, lines, currency, settledLabel } = input
  if (lines.length === 0) {
    return `${title}\n\n${settledLabel}`
  }
  const body = lines
    .map((line) => `- ${line.from} → ${line.to}: ${formatAmount(line.amountCents, currency)}`)
    .join('\n')
  return `${title}\n\n${body}`
}
