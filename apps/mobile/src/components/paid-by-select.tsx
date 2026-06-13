import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Surface } from '@/components/ui/surface'

type PaidByMember = { id: string; user_id: string | null; display_name: string | null }

type PaidBySelectProps = {
  label?: string
  value: string | null
  // Active members only (the server rejects an inactive payer); useTripMembers already filters.
  members: readonly PaidByMember[]
  currentUserId?: string
  onChange: (memberId: string) => void
}

// Horizontal chip selector for the expense payer (one active member), styled as a chip row.
export function PaidBySelect({
  label,
  value,
  members,
  currentUserId,
  onChange,
}: PaidBySelectProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()

  return (
    <>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
      >
        {members.map((member) => {
          const active = member.id === value
          const name =
            member.user_id === currentUserId
              ? t('common.you')
              : (member.display_name ?? t('common.member'))
          return (
            <Pressable
              key={member.id}
              onPress={() => onChange(member.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Surface
                radius={theme.radius.md}
                color={active ? theme.colors.primary : theme.colors.card}
                borderColor={active ? theme.colors.primary : theme.colors.border}
                style={styles.chip}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{name}</Text>
              </Surface>
            </Pressable>
          )
        })}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create((theme) => ({
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  row: {
    gap: theme.gap(2),
    paddingVertical: theme.gap(1),
  },
  chip: {
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(4),
  },
  chipText: {
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  chipTextActive: {
    color: theme.colors.primaryForeground,
  },
}))
