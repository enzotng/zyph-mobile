import { useGlobalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Platform, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { TripMapCanvas, useWayfinderTargets } from '@/features/wayfinder'
import { paramString } from '@/lib/routing'

export default function TripMapScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { t } = useTranslation()
  const { theme, rt } = useUnistyles()
  // Members are included so a member-only trip still counts as non-empty.
  const { targets } = useWayfinderTargets(tripId, true)

  if (Platform.OS !== 'ios') {
    return (
      <Screen title={t('map.title')} showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('map.iosOnly')}</Text>
        </View>
      </Screen>
    )
  }

  if (targets.length === 0) {
    return (
      <Screen title={t('map.title')} showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('map.empty')}</Text>
        </View>
      </Screen>
    )
  }

  return <TripMapCanvas tripId={tripId} topInset={rt.insets.top + theme.gap(2)} />
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    textAlign: 'center',
    color: theme.colors.muted,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
  },
}))
