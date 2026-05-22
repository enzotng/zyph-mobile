import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ZYPH</Text>
      <Text style={styles.subtitle}>Offline-first travel</Text>
      <Button label="Get started" onPress={() => {}} />
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(3),
    paddingTop: rt.insets.top,
    paddingHorizontal: theme.gap(6),
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
}))
