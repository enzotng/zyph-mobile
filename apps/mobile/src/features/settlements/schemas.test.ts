import { recordSettlementSchema } from './schemas'

describe('recordSettlementSchema', () => {
  const base = { fromMemberId: 'm1', toMemberId: 'm2' }

  it('accepts dot and comma decimals and whole numbers', () => {
    expect(recordSettlementSchema.safeParse({ ...base, amount: '12.50' }).success).toBe(true)
    expect(recordSettlementSchema.safeParse({ ...base, amount: '12,50' }).success).toBe(true)
    expect(recordSettlementSchema.safeParse({ ...base, amount: '8' }).success).toBe(true)
  })

  it('rejects empty, negative, or over-precise amounts', () => {
    expect(recordSettlementSchema.safeParse({ ...base, amount: '' }).success).toBe(false)
    expect(recordSettlementSchema.safeParse({ ...base, amount: '-5' }).success).toBe(false)
    expect(recordSettlementSchema.safeParse({ ...base, amount: '12.345' }).success).toBe(false)
    expect(recordSettlementSchema.safeParse({ ...base, amount: 'abc' }).success).toBe(false)
  })

  it('requires both members', () => {
    expect(
      recordSettlementSchema.safeParse({ fromMemberId: '', toMemberId: 'm2', amount: '5' }).success,
    ).toBe(false)
    expect(
      recordSettlementSchema.safeParse({ fromMemberId: 'm1', toMemberId: '', amount: '5' }).success,
    ).toBe(false)
  })
})
