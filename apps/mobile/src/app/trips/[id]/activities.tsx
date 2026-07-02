import { FlashList } from '@shopify/flash-list'
import { useGlobalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { Chip, EmptyState, ErrorState, Skeleton, Spinner } from '@/components/ui'
import {
  ActivityDetailSheet,
  categoriesForTrip,
  type Poi,
  PoiCard,
  usePois,
} from '@/features/places'
import { useEvents } from '@/features/timeline'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

// Static placeholder count for the loading grid (3 rows x 2 columns).
const SKELETON_CELLS = [0, 1, 2, 3, 4, 5]

// A finite, non-null coordinate. Trip lat/lng are nullable in the DB and only meaningful once a
// destination is set, so the grid query (and its "pick a destination" gate) both hinge on this.
function isFiniteCoord(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export default function ActivitiesScreen() {
  const params = useGlobalSearchParams<{ id: string; focus?: string }>()
  const tripId = paramString(params.id)
  // Optional target POI id (e.g. from a timeline CTA) to open in the detail sheet on arrival.
  const focusId = paramString(params.focus) || null
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  const { data: trip, isLoading: tripLoading, isError: tripError } = useTrip(tripId)
  const { data: events } = useEvents(tripId)

  // Trip's profile interests first, then highlights/food, or the default set with no interests.
  const categories = useMemo(() => categoriesForTrip(trip?.interests ?? []), [trip?.interests])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = categories.find((category) => category.key === activeKey) ?? categories[0]

  const poisInput =
    trip && isFiniteCoord(trip.latitude) && isFiniteCoord(trip.longitude)
      ? { lat: trip.latitude, lng: trip.longitude, includedTypes: active.googleTypes, max: 20 }
      : null
  const hasCoords = poisInput !== null

  const {
    data: pois,
    isLoading: poisLoading,
    isError: poisError,
    refetch: refetchPois,
  } = usePois(poisInput)

  // Places already on the trip's itinerary, so the grid (and the sheet) can flag them.
  const placeIdsInPlan = useMemo(
    () =>
      new Set(
        (events ?? [])
          .map((event) => event.place_id)
          .filter((placeId): placeId is string => placeId !== null),
      ),
    [events],
  )

  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null)

  // Opens the focused POI in the sheet exactly once, as soon as it shows up in the loaded grid.
  // Adjusted during render (React's supported pattern for derived state, mirroring
  // ActivityDetailSheet's own session-reset guard) rather than in an effect, so re-renders from
  // refetches or category switches never re-open a sheet the user has since closed.
  const [openedFocusId, setOpenedFocusId] = useState<string | null>(null)
  if (focusId && pois && openedFocusId !== focusId) {
    const match = pois.find((poi) => poi.placeId === focusId)
    if (match) {
      setOpenedFocusId(focusId)
      setSelectedPoi(match)
    }
  }

  if (tripLoading) {
    return (
      <Screen title={t('activities.title')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (tripError || !trip) {
    return (
      <Screen title={t('activities.title')} showBack>
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('activities.notFound')}</Text>
        </View>
      </Screen>
    )
  }

  if (!hasCoords) {
    return (
      <Screen title={t('activities.title')} showBack>
        <EmptyState
          icon="compass-outline"
          title={t('activities.noDestination')}
          body={t('activities.noDestinationBody')}
        />
      </Screen>
    )
  }

  return (
    <Screen title={t('activities.title')} showBack>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsRow}
      >
        {categories.map((category) => (
          <Chip
            key={category.key}
            label={t(category.labelKey)}
            selected={category.key === active.key}
            onPress={() => setActiveKey(category.key)}
          />
        ))}
      </ScrollView>

      {poisLoading ? (
        <View style={styles.skeletonGrid}>
          {SKELETON_CELLS.map((cell) => (
            <View key={cell} style={styles.skeletonCell}>
              <Skeleton height={120} radius={theme.radius.lg} />
              <Skeleton
                width="80%"
                height={14}
                radius={theme.radius.sm}
                style={styles.skeletonGap}
              />
              <Skeleton
                width="50%"
                height={12}
                radius={theme.radius.sm}
                style={styles.skeletonGap}
              />
            </View>
          ))}
        </View>
      ) : poisError ? (
        <ErrorState
          title={t('errors.title')}
          body={t('errors.body')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetchPois()}
        />
      ) : !pois || pois.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title={t('activities.empty')}
          body={t('activities.emptyBody')}
        />
      ) : (
        <FlashList
          data={pois}
          numColumns={2}
          keyExtractor={(poi) => poi.placeId}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <PoiCard
                poi={item}
                inPlan={placeIdsInPlan.has(item.placeId)}
                onPress={() => setSelectedPoi(item)}
              />
            </View>
          )}
        />
      )}

      <ActivityDetailSheet
        poi={selectedPoi}
        trip={trip}
        categoryLabel={t(active.labelKey)}
        inPlan={selectedPoi !== null && placeIdsInPlan.has(selectedPoi.placeId)}
        onClose={() => setSelectedPoi(null)}
      />
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  chipsRow: {
    flexGrow: 0,
    marginBottom: theme.gap(3),
  },
  chips: {
    flexDirection: 'row',
    gap: theme.gap(2),
    paddingRight: theme.gap(2),
  },
  grid: {
    paddingBottom: rt.insets.bottom + theme.gap(6),
  },
  cell: {
    flex: 1,
    margin: theme.gap(1),
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skeletonCell: {
    width: '50%',
    padding: theme.gap(1),
  },
  skeletonGap: {
    marginTop: theme.gap(2),
  },
}))
