import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Avatar } from '@/components/ui'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

export type MemberChipsMember = {
  userId: string
  displayName: string | null
  avatarUrl: string | null
}

type MemberChipsProps = {
  members: MemberChipsMember[]
  // Subset of `members` this event/expense concerns. [] means "everyone" - the same
  // convention `trip_events.participants` uses server-side; the caller maps [] <-> null.
  selected: string[]
  onChange: (ids: string[]) => void
  label: string
}

// A wrap of avatar+name pill chips, one per member, with an "everyone by default" toggle
// invariant: [] renders every chip checked. Tapping while [] deselects everyone but the tapped
// member (rather than starting from a single-member selection), and re-checking the last missing
// member collapses back to [] instead of listing every id out explicitly. Symmetrically,
// unchecking the last remaining member also yields [] - a shared event always concerns someone,
// so emptying the subset returns to "everyone" rather than leaving every chip unchecked.
export function MemberChips({ members, selected, onChange, label }: MemberChipsProps) {
  const { t } = useTranslation()

  if (members.length === 0) {
    return null
  }

  function toggle(memberId: string) {
    haptics.selection()
    const memberIds = members.map((m) => m.userId)
    onChange(toggleMember(selected, memberIds, memberId))
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {members.map((member) => {
          const checked = selected.length === 0 || selected.includes(member.userId)
          return (
            <Pressable
              key={member.userId}
              onPress={() => toggle(member.userId)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={member.displayName ?? t('common.member')}
              style={[styles.chip, checked ? styles.chipSelected : null]}
            >
              <Avatar name={member.displayName ?? '?'} imageUrl={member.avatarUrl} size={28} />
              <Text
                style={[styles.chipText, checked ? styles.chipTextSelected : null]}
                numberOfLines={1}
              >
                {firstName(member.displayName)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function toggleMember(current: string[], memberIds: string[], memberId: string): string[] {
  const next =
    current.length === 0
      ? memberIds.filter((id) => id !== memberId)
      : current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
  return memberIds.length > 0 && memberIds.every((id) => next.includes(id)) ? [] : next
}

function firstName(displayName: string | null): string {
  return displayName?.trim().split(/\s+/)[0] || '?'
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    gap: theme.gap(1.5),
  },
  label: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
    paddingVertical: theme.gap(1),
    paddingHorizontal: theme.gap(2),
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
  },
  chipText: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    maxWidth: theme.gap(20),
  },
  chipTextSelected: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '700',
  },
}))
