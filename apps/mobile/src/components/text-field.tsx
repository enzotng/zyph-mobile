import { type ComponentProps, forwardRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Surface } from '@/components/ui/surface'

type TextFieldProps = ComponentProps<typeof TextInput> & {
  // Optional: search-style fields render placeholder-only (no label).
  label?: string
  error?: string | undefined
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, onFocus, onBlur, style, ...props },
  ref,
) {
  const { theme } = useUnistyles()
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? theme.colors.destructive
    : focused
      ? theme.colors.primary
      : theme.colors.border

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Surface
        radius={theme.radius.md}
        color={theme.colors.card}
        borderColor={borderColor}
        borderWidth={1.5}
      >
        <TextInput
          ref={ref}
          placeholderTextColor={theme.colors.muted}
          {...props}
          style={[styles.input, style]}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
        />
      </Surface>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
})

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(1),
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.foreground,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: theme.gap(3),
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.sans.regular,
  },
  error: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.destructive,
    fontFamily: theme.fonts.sans.regular,
  },
}))
