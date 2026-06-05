import { Ionicons } from '@expo/vector-icons'
import { type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

import { Surface } from './surface'

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
        <Surface
          width={38}
          height={38}
          radius={theme.radius.md}
          color={withAlpha(resolvedIconColor, 0.12)}
          borderWidth={0}
          style={styles.iconTile}
        >
          <Ionicons name={icon} size={20} color={resolvedIconColor} />
        </Surface>
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
    const handlePress = () => {
      haptics.light()
      onPress()
    }

    return (
      <Pressable
        style={({ pressed }) => [styles.row(last), pressed && styles.pressed]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
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
    transform: [{ scale: 0.98 }],
  },
  iconTile: {
    width: 38,
    height: 38,
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
    fontFamily: theme.fonts.sans.regular,
  }),
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.sans.regular,
  },
  detail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.sans.regular,
  },
}))
