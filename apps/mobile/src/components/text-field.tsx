import { type ComponentProps, forwardRef } from 'react'
import { Text, TextInput, View } from 'react-native'
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles'

type TextFieldProps = ComponentProps<typeof TextInput> & {
  label: string
  error?: string | undefined
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, ...props },
  ref,
) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        style={styles.input(Boolean(error))}
        placeholderTextColor={UnistylesRuntime.getTheme().colors.muted}
        {...props}
      />
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
    color: theme.colors.foreground,
  },
  input: (hasError: boolean) => ({
    height: 48,
    paddingHorizontal: theme.gap(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: hasError ? theme.colors.destructive : theme.colors.border,
    backgroundColor: theme.colors.card,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
  }),
  error: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.destructive,
  },
}))
