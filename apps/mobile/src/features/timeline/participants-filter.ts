// Whether an event concerns the given user. An event with no participants subset (null or [])
// concerns everyone - the same "everyone by default" convention `trip_events.participants` uses
// server-side. A signed-out user (no userId) never matches an actual subset.
export function concernsUser(
  participants: string[] | null | undefined,
  userId: string | null,
): boolean {
  if (!participants || participants.length === 0) return true
  return userId != null && participants.includes(userId)
}

// The trip-member fields needed to resolve a participants subset into avatar props.
export type ParticipantMember = {
  id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
}

// Resolves a participants subset to the matching (still-active) trip members, for a compact
// avatar stack. Members who left the trip since simply drop out instead of showing a broken
// avatar. [] for "everyone" (null/empty participants) - nothing to single out visually.
export function resolveParticipantAvatars(ids: string[] | null, members: ParticipantMember[]) {
  if (!ids || ids.length === 0) {
    return []
  }
  const idSet = new Set(ids)
  return members
    .filter((m) => idSet.has(m.user_id))
    .map((m) => ({ id: m.id, name: m.display_name ?? undefined, imageUrl: m.avatar_url }))
}
