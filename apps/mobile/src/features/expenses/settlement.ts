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
