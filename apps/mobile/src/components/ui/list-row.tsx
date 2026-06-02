import { Ionicons } from '@expo/vector-icons'
import { type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { withAlpha } from '@/lib/color'

type ListRowProps = {
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
  title: string
  subtitle?: string
  detail?: string
  right?: ReactNode
  onPress?: () => void
  last?: boolean
  danger?: boolean
  accessibilityLabel?: string
}

export function ListRow({
  icon,
  iconColor,
  title,
  subtitle,
  detail,
  right,
  onPress,
  last = false,
  danger = false,
  accessibilityLabel,
}: ListRowProps) {
  const { theme } = useUnistyles()

  const resolvedIconColor = iconColor ?? theme.colors.primary

  const inner = (
    <>
      {icon ? (
        <View style={[styles.iconTile, { backgroundColor: withAlpha(resolvedIconColor, 0.12) }]}>
          <Ionicons name={icon} size={20} color={resolvedIconColor} />
        </View>
      ) : null}

      <View style={styles.content}>
        <Text style={styles.title(danger)} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {detail ? (
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}

      {right ? (
        right
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
      ) : null}
    </>
  )

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.row(last), pressed && styles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {inner}
      </Pressable>
    )
  }

  return <View style={styles.row(last)}>{inner}</View>
}

const styles = StyleSheet.create((theme) => ({
  row: (last: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    minHeight: 56,
    paddingVertical: theme.gap(2),
    borderBottomWidth: last ? 0 : 1,
    borderBottomColor: theme.colors.border,
  }),
  pressed: {
    opacity: 0.85,
  },
  iconTile: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: theme.gap(0.5),
  },
  title: (danger: boolean) => ({
    fontSize: theme.fontSize.md,
    color: danger ? theme.colors.destructive : theme.colors.foreground,
  }),
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  detail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
}))
