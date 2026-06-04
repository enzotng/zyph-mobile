import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { useIsOnline } from '@/lib/online-manager'

// A thin app-wide bar shown only while offline. Absolutely positioned over the top inset
// region and pointer-transparent, so it never blocks taps on the screen below.
export function OfflineBanner() {
  const online = useIsOnline()
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  if (online) {
    return null
  }

  return (
    <View style={styles.banner} pointerEvents="none" accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={14} color={theme.colors.background} />
      <Text style={styles.text}>{t('offline.banner')}</Text>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(2),
    paddingTop: rt.insets.top,
    paddingBottom: theme.gap(1),
    backgroundColor: theme.colors.foreground,
  },
  text: {
    color: theme.colors.background,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.xs,
  },
}))
