import { Link } from 'expo-router'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

export default function CheckEmailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.body}>
        We sent you a confirmation link. Tap it to activate your account, then sign in.
      </Text>
      <Link href="/(auth)/sign-in" style={styles.link}>
        Back to sign in
      </Link>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.gap(3),
    paddingHorizontal: theme.gap(6),
    paddingTop: rt.insets.top,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  body: {
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
}))
