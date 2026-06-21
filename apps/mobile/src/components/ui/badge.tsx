import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { withAlpha } from '@/lib/color'

type BadgeTone = 'primary' | 'success' | 'warning' | 'destructive' | 'muted' | 'accent' | 'live'

type BadgeProps = {
  label: string
  tone?: BadgeTone
  icon?: keyof typeof Ionicons.glyphMap
  solid?: boolean
}

function resolveToneColor(
  tone: BadgeTone,
  theme: ReturnType<typeof useUnistyles>['theme'],
): string {
  switch (tone) {
    case 'primary':
      return theme.colors.primary
    case 'success':
      return theme.colors.success
    case 'warning':
      return theme.colors.warning
    case 'destructive':
      return theme.colors.destructive
    case 'muted':
      return theme.colors.muted
    case 'accent':
      return theme.colors.primary
    case 'live':
      return theme.colors.live
  }
}

export function Badge({ label, tone = 'primary', icon, solid = false }: BadgeProps) {
  const { theme } = useUnistyles()

  const toneColor = resolveToneColor(tone, theme)
  const backgroundColor = solid ? toneColor : withAlpha(toneColor, 0.14)
  const contentColor = solid ? '#FFFFFF' : toneColor

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {icon ? <Ionicons name={icon} size={13} color={contentColor} /> : null}
      <Text style={[styles.label, { color: contentColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.gap(1),
    borderRadius: theme.radius.full,
    paddingVertical: 3,
    paddingHorizontal: theme.gap(2),
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
  },
}))
