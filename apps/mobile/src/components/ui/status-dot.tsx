import { View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

export type StatusDotTone = 'success' | 'warning' | 'muted'

type StatusDotProps = {
  tone: StatusDotTone
  size?: number
}

// A small tinted dot with a card-coloured ring so it reads over a photo.
export function StatusDot({ tone, size = 12 }: StatusDotProps) {
  const { theme } = useUnistyles()
  const color =
    tone === 'success'
      ? theme.colors.success
      : tone === 'warning'
        ? theme.colors.warning
        : theme.colors.muted

  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size, backgroundColor: color },
      ]}
    />
  )
}

const styles = StyleSheet.create((theme) => ({
  dot: {
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
}))
