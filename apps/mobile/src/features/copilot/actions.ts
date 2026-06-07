import type { TripMember } from '@/features/group'

export type ExpenseSplit = { memberId: string; shareCents: number }

const SELF_ALIASES = ['me', 'moi', 'myself', 'moi-même']

// Resolves a member name from a copilot action to a trip_members id. "me"/"moi" -> the current
// user's member; otherwise a case-insensitive display-name match. Null when unresolved.
export function resolveMemberId(
  name: string,
  members: TripMember[],
  myUserId: string,
): string | null {
  const n = name.trim().toLowerCase()
  if (!n) {
    return null
  }
  if (SELF_ALIASES.includes(n)) {
    return members.find((m) => m.user_id === myUserId)?.id ?? null
  }
  return members.find((m) => (m.display_name ?? '').trim().toLowerCase() === n)?.id ?? null
}

// Equal split of a cent total across members; the remainder goes to the first members so the
// shares sum exactly to the total (deterministic largest-remainder).
export function splitEqually(totalCents: number, memberIds: string[]): ExpenseSplit[] {
  if (memberIds.length === 0) {
    return []
  }
  const base = Math.floor(totalCents / memberIds.length)
  let remainder = totalCents - base * memberIds.length
  return memberIds.map((memberId) => {
    const extra = remainder > 0 ? 1 : 0
    remainder -= extra
    return { memberId, shareCents: base + extra }
  })
}

// A positive major-unit amount from the LLM -> integer cents. Null when invalid. The tiny epsilon
// corrects IEEE-754 error so values like 1.005 round up to 101 instead of down to 100.
export function amountToCents(amount: unknown): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return null
  }
  return Math.round(amount * 100 + 1e-6)
}

// Resolves "splitWith" to member ids. "all", a missing value, or an empty list -> all active
// members. A NON-EMPTY list of names resolves to exactly the matched members - it never widens
// to everyone, so the user never silently confirms a broader split than was proposed (returns
// [] if none match, which the caller rejects).
export function resolveSplitMembers(
  splitWith: unknown,
  members: TripMember[],
  myUserId: string,
): string[] {
  const active = members.map((m) => m.id)
  if (splitWith === 'all' || !Array.isArray(splitWith) || splitWith.length === 0) {
    return active
  }
  const ids = new Set<string>()
  for (const name of splitWith) {
    if (typeof name === 'string') {
      const id = resolveMemberId(name, members, myUserId)
      if (id) {
        ids.add(id)
      }
    }
  }
  return [...ids]
}
