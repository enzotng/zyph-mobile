import { Ionicons } from '@expo/vector-icons'
import { Link, useRouter } from 'expo-router'
import { Linking, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { withAlpha } from '@/lib/color'

export default function CheckEmailScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()

  function openMailApp() {
    Linking.openURL('message://').catch(() => {
      Linking.openURL('mailto:').catch(() => {})
    })
  }

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: withAlpha(theme.colors.primary, 0.1) }]}>
        <Ionicons name="mail-unread-outline" size={40} color={theme.colors.primary} />
      </View>

      <Text style={styles.title}>Vérifie tes e-mails</Text>
      <Text style={styles.body}>
        On t’a envoyé un lien de confirmation. Ouvre-le pour activer ton compte, puis connecte-toi.
      </Text>

      <View style={styles.action}>
        <Button label="Ouvrir l'app mail" icon="open-outline" onPress={openMailApp} />
      </View>

      <Pressable
        onPress={() => router.replace('/(auth)/sign-in')}
        accessibilityRole="button"
        hitSlop={8}
      >
        <Text style={styles.resend}>Retour à la connexion</Text>
      </Pressable>

      <Link href="/(auth)/sign-up" style={styles.link}>
        Renvoyer l’e-mail
      </Link>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(3.5),
    paddingHorizontal: theme.gap(8),
    paddingTop: rt.insets.top,
    backgroundColor: theme.colors.background,
  },
  iconCircle: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  body: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 300,
  },
  action: {
    alignSelf: 'stretch',
    maxWidth: 320,
    marginTop: theme.gap(1),
  },
  resend: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
  link: {
    fontFamily: theme.fonts.sans.semibold,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    fontWeight: '600',
  },
}))
