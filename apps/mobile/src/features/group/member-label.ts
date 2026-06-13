type LabelMember = { user_id: string | null; display_name: string | null }

// Resolve a member's display label: "you" for the current user, the display name otherwise, and a
// fallback when the name is missing (removed or guest members). Pre-translated strings keep this
// pure and testable, and give every screen one identity token instead of ad-hoc inline versions.
export function memberLabel(
  member: LabelMember,
  currentUserId: string | undefined,
  labels: { you: string; fallback: string },
): string {
  if (member.user_id && member.user_id === currentUserId) {
    return labels.you
  }
  return member.display_name ?? labels.fallback
}
