import { Ionicons } from '@expo/vector-icons'
import { type GestureResponderEvent, Pressable, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Squircle } from '@/components/ui/squircle'
import { withAlpha } from '@/lib/color'

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'
type ButtonSize = 'sm' | 'md'

type ButtonProps = {
  label: string
  onPress?: (event: GestureResponderEvent) => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  // Full-width by default; set false for an inline, content-sized button.
  block?: boolean
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon,
  block = true,
}: ButtonProps) {
  const { theme } = useUnistyles()

  const palette = {
    primary: {
      fill: theme.colors.primary,
      border: undefined,
      borderWidth: 0,
      text: theme.colors.primaryForeground,
    },
    secondary: {
      fill: theme.colors.card,
      border: theme.colors.border,
      borderWidth: 1,
      text: theme.colors.foreground,
    },
    destructive: {
      fill: withAlpha(theme.colors.destructive, 0.12),
      border: undefined,
      borderWidth: 0,
      text: theme.colors.destructive,
    },
    ghost: {
      fill: 'transparent',
      border: undefined,
      borderWidth: 0,
      text: theme.colors.primary,
    },
  }[variant]

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.pressable(block),
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Squircle
        radius={theme.radius.md}
        color={palette.fill}
        borderColor={palette.border}
        borderWidth={palette.borderWidth}
        style={styles.content(size)}
      >
        {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={palette.text} /> : null}
        <Text style={[styles.label(size), { color: palette.text }]}>{label}</Text>
      </Squircle>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  pressable: (block: boolean) => ({
    alignSelf: block ? 'stretch' : 'flex-start',
  }),
  content: (size: ButtonSize) => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(2),
    minHeight: size === 'sm' ? 40 : 48,
    paddingVertical: size === 'sm' ? theme.gap(2) : theme.gap(3),
    paddingHorizontal: size === 'sm' ? theme.gap(4) : theme.gap(6),
  }),
  label: (size: ButtonSize) => ({
    fontWeight: '600',
    fontSize: size === 'sm' ? theme.fontSize.sm : theme.fontSize.md,
  }),
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
}))
