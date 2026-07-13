import { useLocalSearchParams } from 'expo-router'
import { Platform } from 'react-native'

import { PoiListView } from '@/features/places'
import { ImmersiveMap } from '@/features/wayfinder'
import { paramString } from '@/lib/routing'

// Pushed over the trip stack (not a tab): the immersive map genuinely hides the floating trip
// tab bar instead of it being conditionally hidden, and iOS swipe-back works for free.
export default function PoisScreen() {
  const params = useLocalSearchParams<{ id: string; focus?: string }>()
  const tripId = paramString(params.id)
  // Optional target id (e.g. from a place's "Open in map") to centre + open on arrival.
  const focusId = paramString(params.focus) || null

  if (Platform.OS === 'ios') {
    return <ImmersiveMap tripId={tripId} focusId={focusId} />
  }
  return <PoiListView tripId={tripId} />
}
