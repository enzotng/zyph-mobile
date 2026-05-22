import { AppleMaps } from 'expo-maps'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Platform, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { useEvents } from '@/features/timeline'
import { paramString } from '@/lib/routing'

export default function TripMapScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { data: events } = useEvents(tripId)

  const located = (events ?? []).filter(
    (event): event is typeof event & { lat: number; lng: number } =>
      event.lat != null && event.lng != null,
  )

  if (Platform.OS !== 'ios') {
    return (
      <Screen title="Map" showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>The map is available on iOS.</Text>
        </View>
      </Screen>
    )
  }

  if (located.length === 0) {
    return (
      <Screen title="Map" showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>
            No event has a location yet. Add one when creating an event.
          </Text>
        </View>
      </Screen>
    )
  }

  const markers = located.map((event) => ({
    id: event.id,
    coordinates: { latitude: event.lat, longitude: event.lng },
    title: event.title,
  }))

  return (
    <Screen title="Map" showBack>
      <View style={styles.mapWrap}>
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
