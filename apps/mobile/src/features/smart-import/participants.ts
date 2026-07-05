// Matches booking passenger names to trip members so Smart Import can preselect who an event
// concerns. Pure and deliberately forgiving: booking systems uppercase, strip accents, and add
// middle names - a member matches when every token of their display name is covered by one
// passenger name (exact, >=4-char prefix either way, or one edit apart).
function fold(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[\s-]+/)
    .filter((token) => token.length > 0)
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 4 && b.startsWith(a)) return true
  if (b.length >= 4 && a.startsWith(b)) return true
  return editDistanceIsAtMostOne(a, b)
}

function editDistanceIsAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (a.length > b.length) i += 1
    else if (b.length > a.length) j += 1
    else {
      i += 1
      j += 1
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

export function matchParticipants(
  names: string[],
  members: { userId: string; displayName: string | null }[],
): string[] {
  const nameTokens = names.map(fold).filter((tokens) => tokens.length > 0)
  return members
    .filter((member) => {
      if (!member.displayName) return false
      const memberTokens = fold(member.displayName)
      if (memberTokens.length === 0) return false
      return nameTokens.some((tokens) =>
        memberTokens.every((mt) => tokens.some((nt) => tokensMatch(mt, nt))),
      )
    })
    .map((member) => member.userId)
}
