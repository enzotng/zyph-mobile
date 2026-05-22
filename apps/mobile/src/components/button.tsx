import { type GestureResponderEvent, Pressable, Text } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

type ButtonProps = {
  label: string
  onPress?: (event: GestureResponderEvent) => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

export function Button({ label, onPress, variant = 'primary', disabled = false }: ButtonProps) {
  styles.useVariants({ variant })

  return (
    <Pressable
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  button: {
    alignItems: 'center',
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(6),
    borderRadius: theme.radius.md,
    variants: {
      variant: {
        primary: { backgroundColor: theme.colors.primary },
        secondary: {
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
      },
    },
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    variants: {
      variant: {
        primary: { color: theme.colors.primaryForeground },
        secondary: { color: theme.colors.foreground },
      },
    },
  },
}))
