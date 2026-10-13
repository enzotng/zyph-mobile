import { memberLabel } from './member-label'

const labels = { you: 'You', fallback: 'Member' }

describe('memberLabel', () => {
  it('returns "you" for the current user', () => {
    expect(memberLabel({ user_id: 'u1', display_name: 'Alice' }, 'u1', labels)).toBe('You')
  })

  it('returns the display name for another member', () => {
    expect(memberLabel({ user_id: 'u2', display_name: 'Alice' }, 'u1', labels)).toBe('Alice')
  })

  it('falls back when the display name is missing', () => {
    expect(memberLabel({ user_id: 'u2', display_name: null }, 'u1', labels)).toBe('Member')
  })

  it('does not match "you" when there is no current user or no user_id', () => {
    expect(memberLabel({ user_id: null, display_name: 'Guest' }, 'u1', labels)).toBe('Guest')
    expect(memberLabel({ user_id: 'u1', display_name: 'Alice' }, undefined, labels)).toBe('Alice')
  })

  it('labels a ghost by the name carried on its place', () => {
    expect(memberLabel({ user_id: null, display_name: 'Léa' }, 'u1', labels)).toBe('Léa')
  })

  // trip_members_ghost_has_name rules this row out of the database, so the fallback here only
  // guards a caller passing a partially built member.
  it('falls back for an unbound place with no alias', () => {
    expect(memberLabel({ user_id: null, display_name: null }, 'u1', labels)).toBe('Member')
  })
})
