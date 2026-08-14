import { Ionicons } from '@expo/vector-icons'
import { type ReactNode } from 'react'
import {
  type AccessibilityRole,
  type AccessibilityState,
  Pressable,
  Text,
  View,
} from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

import { Surface } from './surface'

type ListRowProps = {
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
  title: string
  // Renders ahead of the title in its own node. Use when the leading word is untrusted text: on
  // one line it is the only thing that shrinks, so it cannot borrow the title's words to read as
  // a longer sentence than it is.
  titleActor?: string
  subtitle?: string
  detail?: string
  right?: ReactNode
  onPress?: () => void
  last?: boolean
  danger?: boolean
  accessibilityLabel?: string
  // Defaults to "button"; pass "checkbox" so a togglable row exposes its checked state to
  // screen readers (the visual icon alone does not).
  accessibilityRole?: AccessibilityRole
  accessibilityState?: AccessibilityState
}

export function ListRow({
  icon,
  iconColor,
  title,
  titleActor,
  subtitle,
  detail,
  right,
  onPress,
  last = false,
  danger = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
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
        {titleActor ? (
          <View style={styles.titleRow}>
            <Text style={styles.titleActor(danger)} numberOfLines={1}>
              {titleActor}
            </Text>
            <Text style={styles.titleRest(danger)} numberOfLines={1}>
              {title}
            </Text>
          </View>
        ) : (
          <Text style={styles.title(danger)} numberOfLines={1}>
            {title}
          </Text>
        )}
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
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
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
  // The two Texts must stay SIBLINGS. Nesting one inside the other - the obvious tidy-up for the
  // space between them - collapses both into a single bidi paragraph, and a name starting with a
  // strong RTL character would once again flip the app's own words. This structure IS the control,
  // and no test sees the difference.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  // The weight difference against titleRest is load-bearing, not decoration: when a short forged
  // name fits without truncating, it is the only thing telling the reader where the name ends and
  // the app's words begin.
  titleActor: (danger: boolean) => ({
    flexShrink: 1,
    // Floored: the rest of the line also carries untrusted text on some types, and without this
    // a long name absorbs the whole row and ellipsizes the actor away to nothing.
    maxWidth: '55%',
    fontSize: theme.fontSize.md,
    color: danger ? theme.colors.destructive : theme.colors.foreground,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600' as const,
  }),
  // Shrinks too, but the app's words come first inside it, so what truncates is the untrusted
  // tail - never the verb phrase, and never the actor below its floor.
  titleRest: (danger: boolean) => ({
    flexShrink: 1,
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
