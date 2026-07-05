import {
  concernsUser,
  type ParticipantMember,
  resolveParticipantAvatars,
} from './participants-filter'

describe('concernsUser', () => {
  it('concerns everyone when participants is null', () => {
    expect(concernsUser(null, 'u1')).toBe(true)
  })

  it('concerns everyone when participants is an empty array', () => {
    expect(concernsUser([], 'u1')).toBe(true)
  })

  it('concerns the user when they are in the subset', () => {
    expect(concernsUser(['u1', 'u2'], 'u1')).toBe(true)
  })

  it('does not concern the user when they are missing from the subset', () => {
    expect(concernsUser(['u2', 'u3'], 'u1')).toBe(false)
  })

  it('does not concern a signed-out user against a subset', () => {
    expect(concernsUser(['u1', 'u2'], null)).toBe(false)
  })
})

describe('resolveParticipantAvatars', () => {
  const members: ParticipantMember[] = [
    { id: 'm1', user_id: 'u1', display_name: 'Alice', avatar_url: 'https://a/alice.png' },
    { id: 'm2', user_id: 'u2', display_name: null, avatar_url: null },
    { id: 'm3', user_id: 'u3', display_name: 'Cy', avatar_url: 'https://a/cy.png' },
  ]

  it('resolves a subset to avatar props in members order', () => {
    expect(resolveParticipantAvatars(['u3', 'u1'], members)).toEqual([
      { id: 'm1', name: 'Alice', imageUrl: 'https://a/alice.png' },
      { id: 'm3', name: 'Cy', imageUrl: 'https://a/cy.png' },
    ])
  })

  it('falls back to an undefined name when display_name is null', () => {
    expect(resolveParticipantAvatars(['u2'], members)).toEqual([
      { id: 'm2', name: undefined, imageUrl: null },
    ])
  })

  it('skips ids that have no matching (still-active) member', () => {
    expect(resolveParticipantAvatars(['u1', 'left-the-trip'], members)).toEqual([
      { id: 'm1', name: 'Alice', imageUrl: 'https://a/alice.png' },
    ])
  })

  it('returns [] for null participants (everyone)', () => {
    expect(resolveParticipantAvatars(null, members)).toEqual([])
  })

  it('returns [] for an empty participants subset', () => {
    expect(resolveParticipantAvatars([], members)).toEqual([])
  })
})
