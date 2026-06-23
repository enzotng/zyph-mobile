import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, type GestureResponderEvent, Pressable, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Surface } from '@/components/ui/surface'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'destructive' | 'ghost'
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
  // Busy state: swaps the label+icon for a spinner and blocks onPress while keeping the enabled
  // fill, so the button reads as "working" rather than "disabled".
  loading?: boolean
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon,
  block = true,
  loading = false,
}: ButtonProps) {
  const { theme } = useUnistyles()

  // Loading blocks the press like disabled, but keeps the enabled fill (busy, not disabled).
  const inert = disabled || loading

  const handlePress = (event: GestureResponderEvent) => {
    haptics.light()
    onPress?.(event)
  }

  const palette = {
    // Primary CTA is ink in light / cream in dark (foreground), with inverse text.
    primary: {
      fill: theme.colors.foreground,
      border: undefined,
      borderWidth: 0,
      text: theme.colors.background,
    },
    // Accent (indigo) CTA for brand moments, e.g. onboarding "Get started".
    accent: {
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
      onPress={handlePress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        styles.pressable(block),
        pressed && styles.pressed,
        // Keep the enabled fill while loading so it reads as "busy", not "disabled".
        disabled && styles.disabled,
      ]}
    >
      <Surface
        radius={16}
        color={palette.fill}
        borderColor={palette.border}
        borderWidth={palette.borderWidth}
        style={styles.content(size)}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.text} />
        ) : (
          <>
            {icon ? (
              <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={palette.text} />
            ) : null}
            <Text style={[styles.label(size), { color: palette.text }]}>{label}</Text>
          </>
        )}
      </Surface>
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
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: size === 'sm' ? theme.fontSize.sm : theme.fontSize.md,
  }),
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.5,
  },
}))
