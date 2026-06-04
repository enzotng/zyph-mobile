import * as Location from 'expo-location'
import { AppleMaps } from 'expo-maps'
import { useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { AddressSearchField } from '@/components/address-search-field'

export type Coords = { lat: number; lng: number }

type LocationPickerProps = {
  label?: string
  value: Coords | null
  onChange: (coords: Coords) => void
}

// Apple Maps is iOS-only here; an Android map needs a Google Maps key (later).
export function LocationPicker({ label, value, onChange }: LocationPickerProps) {
  const [locating, setLocating] = useState(false)

  async function requestCurrentLocation() {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Location off', 'Allow location access to use your current position.')
        return
      }
      const position = await Location.getCurrentPositionAsync({})
      onChange({ lat: position.coords.latitude, lng: position.coords.longitude })
    } catch {
      Alert.alert('Location error', 'Could not get your current position.')
    } finally {
      setLocating(false)
    }
  }

  if (Platform.OS !== 'ios') {
    return null
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <AddressSearchField onSelect={(place) => onChange({ lat: place.lat, lng: place.lng })} />
      <View style={styles.mapWrap}>
        <AppleMaps.View
          style={styles.map}
          cameraPosition={
            value
              ? { coordinates: { latitude: value.lat, longitude: value.lng }, zoom: 13 }
              : undefined
          }
          markers={
            value
              ? [{ coordinates: { latitude: value.lat, longitude: value.lng }, title: 'Event' }]
              : []
          }
          onMapClick={(event) => {
            const { latitude, longitude } = event.coordinates
            if (latitude != null && longitude != null) {
              onChange({ lat: latitude, lng: longitude })
            }
          }}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.hint}>
          {value ? 'Tap the map to adjust the pin.' : 'Tap the map to drop a pin.'}
        </Text>
        <Pressable
          onPress={() => void requestCurrentLocation()}
          disabled={locating}
          accessibilityRole="button"
        >
          {locating ? <ActivityIndicator /> : <Text style={styles.link}>Use my location</Text>}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    gap: theme.gap(2),
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  mapWrap: {
    height: 200,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
  },
  map: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hint: {
    flexShrink: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
}))
