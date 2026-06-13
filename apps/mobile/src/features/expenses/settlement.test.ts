import { type MemberBalance, pairwiseBalances, settleBalances } from './settlement'

const sum = (s: { amountCents: number }[]) => s.reduce((acc, x) => acc + x.amountCents, 0)

describe('settleBalances', () => {
  it('returns no transfers when everyone is settled', () => {
    const balances: MemberBalance[] = [
      { memberId: 'a', balanceCents: 0 },
      { memberId: 'b', balanceCents: 0 },
    ]
    expect(settleBalances(balances)).toEqual([])
  })

  it('settles a single debtor against a single creditor', () => {
    const balances: MemberBalance[] = [
      { memberId: 'a', balanceCents: -1500 },
      { memberId: 'b', balanceCents: 1500 },
    ]
    expect(settleBalances(balances)).toEqual([
      { fromMemberId: 'a', toMemberId: 'b', amountCents: 1500 },
    ])
  })

  it('splits one debtor across multiple creditors largest-first', () => {
    const balances: MemberBalance[] = [
      { memberId: 'debtor', balanceCents: -3000 },
      { memberId: 'big', balanceCents: 2000 },
      { memberId: 'small', balanceCents: 1000 },
    ]
    expect(settleBalances(balances)).toEqual([
      { fromMemberId: 'debtor', toMemberId: 'big', amountCents: 2000 },
      { fromMemberId: 'debtor', toMemberId: 'small', amountCents: 1000 },
    ])
  })

  it('produces at most n-1 transfers and the totals reconcile', () => {
    const balances: MemberBalance[] = [
      { memberId: 'a', balanceCents: -2000 },
      { memberId: 'b', balanceCents: -500 },
      { memberId: 'c', balanceCents: 1500 },
      { memberId: 'd', balanceCents: 1000 },
    ]
    const result = settleBalances(balances)
    expect(result.length).toBeLessThanOrEqual(balances.length - 1)
    expect(sum(result)).toBe(2500)
  })

  it('ignores members with a zero balance', () => {
    const balances: MemberBalance[] = [
      { memberId: 'a', balanceCents: -800 },
      { memberId: 'z', balanceCents: 0 },
      { memberId: 'b', balanceCents: 800 },
    ]
    const result = settleBalances(balances)
    expect(result).toEqual([{ fromMemberId: 'a', toMemberId: 'b', amountCents: 800 }])
  })

  it('returns no transfers when there are only debtors (nothing to pay to)', () => {
    const balances: MemberBalance[] = [{ memberId: 'a', balanceCents: -500 }]
    expect(settleBalances(balances)).toEqual([])
  })
})

describe('pairwiseBalances', () => {
  it('groups suggested transfers per member in both directions', () => {
    const map = pairwiseBalances([
      { fromMemberId: 'a', toMemberId: 'b', amountCents: 1200 },
      { fromMemberId: 'a', toMemberId: 'c', amountCents: 800 },
    ])
    expect(map.get('a')).toEqual({
      owes: [
        { memberId: 'b', amountCents: 1200 },
        { memberId: 'c', amountCents: 800 },
      ],
      owedBy: [],
    })
    expect(map.get('b')).toEqual({ owes: [], owedBy: [{ memberId: 'a', amountCents: 1200 }] })
    expect(map.get('c')).toEqual({ owes: [], owedBy: [{ memberId: 'a', amountCents: 800 }] })
  })

  it('returns an empty map when there are no settlements', () => {
    expect(pairwiseBalances([]).size).toBe(0)
  })
})
