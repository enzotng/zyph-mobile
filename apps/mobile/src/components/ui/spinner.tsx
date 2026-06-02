import { ActivityIndicator, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

type SpinnerProps = {
  label?: string
}

export function Spinner({ label }: SpinnerProps) {
  const { theme } = useUnistyles()

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.primary} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(2),
    padding: theme.gap(4),
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.sans.regular,
  },
}))
