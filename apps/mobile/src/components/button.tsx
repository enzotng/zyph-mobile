import { type GestureResponderEvent, Pressable, Text } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

type ButtonProps = {
  label: string
  onPress?: (event: GestureResponderEvent) => void
  variant?: 'primary' | 'secondary'
}

export function Button({ label, onPress, variant = 'primary' }: ButtonProps) {
  styles.useVariants({ variant })

  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button">
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
