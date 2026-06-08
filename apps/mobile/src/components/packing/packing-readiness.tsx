import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Avatar, Surface } from '@/components/ui'
import type { MemberProgress } from '@/features/packing'
import { withAlpha } from '@/lib/color'

type PackingReadinessProps = {
  progress: MemberProgress[]
  unassignedCount: number
  readyPercent: number
  onPressMember?: (memberId: string) => void
}

// Presentational group-readiness card: a "group is X% ready" header + progress bar, one row per
// member with their packed/assigned ratio, and a footer counting items still to assign. Pure
// props in - no fetching - so it never re-renders the list.
export function PackingReadiness({
  progress,
  unassignedCount,
  readyPercent,
  onPressMember,
}: PackingReadinessProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const percent = Math.max(0, Math.min(100, readyPercent))
  const ready = percent === 100 && unassignedCount === 0
  const accent = ready ? theme.colors.success : theme.colors.primary

  return (
    <Surface
      color={theme.colors.card}
      borderColor={theme.colors.border}
      borderWidth={1}
      radius={theme.radius.lg}
      style={styles.card}
    >
      <View style={styles.header}>
        <Ionicons name={ready ? 'checkmark-circle' : 'people-outline'} size={18} color={accent} />
        <Text style={styles.title}>
          {ready ? t('packing.readyDone') : t('packing.readyTitle', { percent })}
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: withAlpha(accent, 0.16) }]}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: accent }]} />
      </View>

      {progress.map((member) => {
        const name = member.name ?? t('common.member')
        const full = member.assigned > 0 && member.packed === member.assigned
        const inner = (
          <View style={styles.memberRow}>
            <Avatar name={name} size={26} />
            <Text style={styles.memberName} numberOfLines={1}>
              {name}
            </Text>
            <Text
              style={[styles.ratio, { color: full ? theme.colors.success : theme.colors.muted }]}
              accessibilityLabel={t('packing.memberRatioA11y', {
                name,
                packed: member.packed,
                assigned: member.assigned,
              })}
            >
              {t('packing.memberRatio', { packed: member.packed, assigned: member.assigned })}
            </Text>
          </View>
        )
        return onPressMember ? (
          <Pressable
            key={member.memberId}
            onPress={() => onPressMember(member.memberId)}
            accessibilityRole="button"
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            {inner}
          </Pressable>
        ) : (
          <View key={member.memberId}>{inner}</View>
        )
      })}

      {unassignedCount > 0 ? (
        <Text style={styles.footer}>{t('packing.toAssign', { count: unassignedCount })}</Text>
      ) : null}
    </Surface>
  )
}

const styles = StyleSheet.create((theme) => ({
  card: {
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
    gap: theme.gap(2.5),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  title: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  track: {
    height: 6,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: theme.radius.full,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
    paddingVertical: theme.gap(1),
  },
  memberName: {
    flex: 1,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  ratio: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  footer: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
}))
