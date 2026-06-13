import { act, renderHook } from '@testing-library/react-native'

import { useSplitEditor } from './use-split-editor'

const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('useSplitEditor - add mode', () => {
  it('includes everyone equally by default', () => {
    const { result } = renderHook(() => useSplitEditor({ members, baseCents: 1200 }))
    expect(result.current.includedCount).toBe(3)
    expect(result.current.splitsFor(1200)).toEqual([
      { memberId: 'a', shareCents: 400 },
      { memberId: 'b', shareCents: 400 },
      { memberId: 'c', shareCents: 400 },
    ])
  })

  it('excludes a member on toggle and re-splits among the rest', () => {
    const { result } = renderHook(() => useSplitEditor({ members, baseCents: 1200 }))
    act(() => result.current.toggle('c'))
    expect(result.current.isIncluded('c')).toBe(false)
    expect(result.current.includedCount).toBe(2)
    expect(result.current.splitsFor(1200)).toEqual([
      { memberId: 'a', shareCents: 600 },
      { memberId: 'b', shareCents: 600 },
    ])
  })

  it('weights an included member', () => {
    const { result } = renderHook(() => useSplitEditor({ members, baseCents: 900 }))
    act(() => result.current.toggle('c'))
    act(() => result.current.setWeight('a', 2))
    expect(result.current.weightFor('a')).toBe(2)
    expect(result.current.splitsFor(900)).toEqual([
      { memberId: 'a', shareCents: 600 },
      { memberId: 'b', shareCents: 300 },
    ])
  })

  it('clamps weight to a minimum of 1', () => {
    const { result } = renderHook(() => useSplitEditor({ members, baseCents: 900 }))
    act(() => result.current.setWeight('a', 0))
    expect(result.current.weightFor('a')).toBe(1)
  })

  it('returns an empty preview until the base amount resolves', () => {
    const { result } = renderHook(() => useSplitEditor({ members, baseCents: null }))
    expect(result.current.shareByMember.size).toBe(0)
  })
})

describe('useSplitEditor - edit mode', () => {
  const initialSplits = [
    { member_id: 'a', share_cents: 500 },
    { member_id: 'b', share_cents: 300 },
    { member_id: 'c', share_cents: 400 },
  ]

  it('preserves an untouched custom split verbatim when the amount is unchanged', () => {
    // The re-equalise bug: re-saving without touching the split must keep 500/300/400.
    const { result } = renderHook(() => useSplitEditor({ members, baseCents: 1200, initialSplits }))
    expect(result.current.splitsFor(1200)).toEqual([
      { memberId: 'a', shareCents: 500 },
      { memberId: 'b', shareCents: 300 },
      { memberId: 'c', shareCents: 400 },
    ])
  })

  it('rescales an untouched split by ratio when the amount changes', () => {
    const { result } = renderHook(() => useSplitEditor({ members, baseCents: 2400, initialSplits }))
    expect(result.current.splitsFor(2400)).toEqual([
      { memberId: 'a', shareCents: 1000 },
      { memberId: 'b', shareCents: 600 },
      { memberId: 'c', shareCents: 800 },
    ])
  })

  it('switches to an equal weight split once the structure is touched', () => {
    const { result } = renderHook(() => useSplitEditor({ members, baseCents: 1200, initialSplits }))
    act(() => result.current.toggle('c'))
    expect(result.current.splitsFor(1200)).toEqual([
      { memberId: 'a', shareCents: 600 },
      { memberId: 'b', shareCents: 600 },
    ])
  })

  it('excludes members that were not in the original split by default', () => {
    const withNewcomer = [...members, { id: 'd' }]
    const { result } = renderHook(() =>
      useSplitEditor({ members: withNewcomer, baseCents: 1200, initialSplits }),
    )
    expect(result.current.isIncluded('d')).toBe(false)
    expect(result.current.includedCount).toBe(3)
  })

  it('drops a removed member from a preserved split and rescales among the active ones', () => {
    // `c` was in the original split but is no longer an active trip member; the update RPC would
    // reject it, so it must not be submitted - the share is reprojected onto the active members.
    const activeMembers = [{ id: 'a' }, { id: 'b' }]
    const { result } = renderHook(() =>
      useSplitEditor({ members: activeMembers, baseCents: 1200, initialSplits }),
    )
    const out = result.current.splitsFor(1200)
    expect(out.find((s) => s.memberId === 'c')).toBeUndefined()
    expect(out.reduce((n, s) => n + s.shareCents, 0)).toBe(1200)
  })

  it('keeps the preserved split after a no-op weight round-trip', () => {
    const { result } = renderHook(() => useSplitEditor({ members, baseCents: 1200, initialSplits }))
    act(() => result.current.setWeight('a', 2))
    act(() => result.current.setWeight('a', 1))
    expect(result.current.splitsFor(1200)).toEqual([
      { memberId: 'a', shareCents: 500 },
      { memberId: 'b', shareCents: 300 },
      { memberId: 'c', shareCents: 400 },
    ])
  })

  it('falls through to an equal split when the original shares were all zero', () => {
    const zeroSplits = [
      { member_id: 'a', share_cents: 0 },
      { member_id: 'b', share_cents: 0 },
    ]
    const { result } = renderHook(() =>
      useSplitEditor({
        members: [{ id: 'a' }, { id: 'b' }],
        baseCents: 1000,
        initialSplits: zeroSplits,
      }),
    )
    expect(result.current.splitsFor(1000)).toEqual([
      { memberId: 'a', shareCents: 500 },
      { memberId: 'b', shareCents: 500 },
    ])
  })
})
