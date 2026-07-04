import { matchParticipants } from './participants'

const members = [
  { userId: 'u1', displayName: 'Zoe Tran' },
  { userId: 'u2', displayName: 'Marc-Antoine Dupont' },
  { userId: 'u3', displayName: 'Lea Petit' },
]

describe('matchParticipants', () => {
  it('matches a long passenger name containing the member tokens', () => {
    expect(matchParticipants(['Zoe Ngoc Mai Tran'], members)).toEqual(['u1'])
  })
  it('matches across diacritics and one-letter drift', () => {
    // "Léa" folds to "lea"; "Petiit" is levenshtein-1 from "petit"
    expect(matchParticipants(['Léa Petiit'], members)).toEqual(['u3'])
  })
  it('matches hyphenated names token by token', () => {
    expect(matchParticipants(['Marc Antoine Dupont'], members)).toEqual(['u2'])
  })
  it('requires every member token to be covered by ONE name', () => {
    // "Zoe" alone must not match "Zoe Tran" (surname unmatched)
    expect(matchParticipants(['Zoe'], members)).toEqual([])
  })
  it('ignores unknown passengers and returns [] on zero matches', () => {
    expect(matchParticipants(['John Smith'], members)).toEqual([])
  })
  it('matches each member at most once and keeps members order', () => {
    expect(matchParticipants(['Lea Petit', 'Zoe Ngoc Mai Tran', 'Lea Petit'], members)).toEqual([
      'u1',
      'u3',
    ])
  })
  it('tolerates null display names', () => {
    expect(matchParticipants(['Zoe Tran'], [{ userId: 'u9', displayName: null }])).toEqual([])
  })
})
