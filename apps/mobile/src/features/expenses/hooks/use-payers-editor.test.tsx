import { act, renderHook } from '@testing-library/react-native'

import { usePayersEditor } from './use-payers-editor'

const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('usePayersEditor - single mode (default)', () => {
  it('defaults to single mode with the fallback payer', () => {
    const { result } = renderHook(() =>
      usePayersEditor({ members, baseCents: 1200, defaultPayerId: 'a' }),
    )
    expect(result.current.mode).toBe('single')
    expect(result.current.payerId).toBe('a')
    expect(result.current.canSubmit).toBe(true)
    expect(result.current.resolve()).toEqual({ paidBy: 'a', payers: null })
  })

  it('changes the single payer', () => {
    const { result } = renderHook(() =>
      usePayersEditor({ members, baseCents: 1200, defaultPayerId: 'a' }),
    )
    act(() => result.current.setPayerId('b'))
    expect(result.current.resolve()).toEqual({ paidBy: 'b', payers: null })
  })

  it('blocks submit when there is no payer', () => {
    const { result } = renderHook(() =>
      usePayersEditor({ members, baseCents: 1200, defaultPayerId: null }),
    )
    expect(result.current.canSubmit).toBe(false)
  })
})

describe('usePayersEditor - multiple mode', () => {
  it('balances when the entered amounts sum to the base and emits only positive payers', () => {
    const { result } = renderHook(() =>
      usePayersEditor({ members, baseCents: 5000, defaultPayerId: 'a' }),
    )
    act(() => result.current.setMode('multiple'))
    act(() => result.current.setAmountValue('a', '30'))
    act(() => result.current.setAmountValue('b', '20'))
    expect(result.current.isBalanced).toBe(true)
    expect(result.current.remainderCents).toBe(0)
    expect(result.current.canSubmit).toBe(true)
    expect(result.current.resolve()).toEqual({
      paidBy: null,
      payers: [
        { memberId: 'a', paidCents: 3000 },
        { memberId: 'b', paidCents: 2000 },
      ],
    })
  })

  it('reports the remainder and blocks submit when amounts do not sum to the base', () => {
    const { result } = renderHook(() =>
      usePayersEditor({ members, baseCents: 5000, defaultPayerId: 'a' }),
    )
    act(() => result.current.setMode('multiple'))
    act(() => result.current.setAmountValue('a', '30'))
    expect(result.current.isBalanced).toBe(false)
    expect(result.current.remainderCents).toBe(2000)
    expect(result.current.canSubmit).toBe(false)
  })
})

describe('usePayersEditor - edit seed', () => {
  it('opens in multiple mode prefilled when more than one payer is persisted', () => {
    const { result } = renderHook(() =>
      usePayersEditor({
        members,
        baseCents: 5000,
        defaultPayerId: 'a',
        initialPayers: [
          { memberId: 'a', paidCents: 3000 },
          { memberId: 'b', paidCents: 2000 },
        ],
      }),
    )
    expect(result.current.mode).toBe('multiple')
    expect(result.current.amountValueFor('a')).toBe('30.00')
    expect(result.current.amountValueFor('b')).toBe('20.00')
    expect(result.current.isBalanced).toBe(true)
  })

  it('opens in single mode on the persisted payer when only one is set', () => {
    const { result } = renderHook(() =>
      usePayersEditor({
        members,
        baseCents: 5000,
        defaultPayerId: 'a',
        initialPayers: [{ memberId: 'c', paidCents: 5000 }],
      }),
    )
    expect(result.current.mode).toBe('single')
    expect(result.current.payerId).toBe('c')
  })
})
