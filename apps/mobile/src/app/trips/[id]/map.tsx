import { AppleMaps } from 'expo-maps'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { useEvents } from '@/features/timeline'
import { paramString } from '@/lib/routing'

export default function TripMapScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { t } = useTranslation()
  const { data: events } = useEvents(tripId)

  const located = useMemo(
    () =>
      (events ?? []).filter(
        (event): event is typeof event & { lat: number; lng: number } =>
          event.lat != null && event.lng != null,
      ),
    [events],
  )

  const markers = useMemo(
    () =>
      located.map((event) => ({
        id: event.id,
        coordinates: { latitude: event.lat, longitude: event.lng },
        title: event.title,
      })),
    [located],
  )

  if (Platform.OS !== 'ios') {
    return (
      <Screen title={t('map.title')} showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('map.iosOnly')}</Text>
        </View>
      </Screen>
    )
  }

  if (located.length === 0) {
    return (
      <Screen title={t('map.title')} showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('map.noLocation')}</Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen title={t('map.title')} showBack>
      <View style={styles.mapWrap} accessibilityLabel="Carte des événements du voyage">
        <AppleMaps.View
          style={styles.map}
          cameraPosition={{ coordinates: markers[0].coordinates, zoom: 11 }}
          markers={markers}
          onMarkerClick={(marker) => {
            if (marker.id) {
              router.push({
                pathname: '/trips/[id]/events/[eventId]',
                params: { id: tripId, eventId: marker.id },
              })
            }
          }}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
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
  mapWrap: {
    flex: 1,
    marginBottom: rt.insets.bottom + theme.gap(2),
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
  },
  map: {
    flex: 1,
  },
}))
