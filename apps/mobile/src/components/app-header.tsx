import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

type AppHeaderProps = {
  title?: string
  // Force the back button on/off; defaults to whether navigation can go back.
  showBack?: boolean
  right?: ReactNode
}

export function AppHeader({ title, showBack, right }: AppHeaderProps) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const canBack = showBack ?? router.canGoBack()

  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {canBack ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={26} color={theme.colors.foreground} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title ?? ''}
      </Text>

      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: rt.insets.top + theme.gap(2),
    paddingBottom: theme.gap(2),
    paddingHorizontal: theme.gap(4),
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  side: {
    width: theme.gap(12),
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: theme.fontSize.lg,
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
}))
