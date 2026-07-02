import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { SectionTitle } from '@/components/ui'
import { useEvents } from '@/features/timeline'
import type { Trip } from '@/features/trips'

import { googleTypesFor } from '../categories'
import { usePois } from '../hooks/use-pois'
import { PoiCard } from './poi-card'

export type ActivitiesRailProps = {
  trip: Trip
}

// Fixed card width for the carousel (PoiCard flexes to fill in the /activities grid instead).
const CARD_WIDTH = 200
// Keeps the teaser short - the full list lives behind "See all".
const MAX_POIS = 10

function isFiniteCoord(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

// Cockpit teaser for the /activities screen: a horizontal carousel of the destination's top
// activities (trip interests + highlights/food), with a "See all" action through to the full
// grid. Purely additive and silent by design - it renders nothing while the trip has no
// coordinates yet, while the search is loading, or if it errors or comes back empty, so a
// still-loading or unlucky search never reads as a broken section on the cockpit.
export function ActivitiesRail({ trip }: ActivitiesRailProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const { data: events } = useEvents(trip.id)

  const poisInput =
    isFiniteCoord(trip.latitude) && isFiniteCoord(trip.longitude)
      ? {
          lat: trip.latitude,
          lng: trip.longitude,
          includedTypes: googleTypesFor(trip.interests),
          max: MAX_POIS,
        }
      : null

  const { data: pois, isLoading, isError } = usePois(poisInput)

  // Places already on the trip's itinerary, so the cards can flag them (same rule as the
  // /activities grid).
  const placeIdsInPlan = useMemo(
    () =>
      new Set(
        (events ?? [])
          .map((event) => event.place_id)
          .filter((placeId): placeId is string => placeId !== null),
      ),
    [events],
  )

  if (!poisInput || isLoading || isError || !pois || pois.length === 0) {
    return null
  }

  const destination = trip.destination?.trim()
  const title = destination ? t('activities.railTitle', { destination }) : t('activities.title')

  function openActivities(focus?: string) {
    router.push({
      pathname: '/trips/[id]/activities',
      params: focus ? { id: trip.id, focus } : { id: trip.id },
    })
  }

  return (
    <View>
      <SectionTitle action={t('activities.seeAll')} onAction={() => openActivities()}>
        {title}
      </SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {pois.map((poi) => (
          <PoiCard
            key={poi.placeId}
            poi={poi}
            width={CARD_WIDTH}
            inPlan={placeIdsInPlan.has(poi.placeId)}
            onPress={() => openActivities(poi.placeId)}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  list: {
    gap: theme.gap(3),
    paddingTop: theme.gap(3),
    paddingBottom: theme.gap(1),
  },
}))
