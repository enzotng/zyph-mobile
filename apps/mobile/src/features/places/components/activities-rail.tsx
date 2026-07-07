import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, useWindowDimensions, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { SectionTitle } from '@/components/ui'
import { useEvents } from '@/features/timeline'
import type { Trip } from '@/features/trips'
import { haptics } from '@/lib/haptics'

import { googleTypesFor } from '../categories'
import { usePois } from '../hooks/use-pois'
import type { Poi } from '../poi.types'
import { PoiHeroCard } from './poi-hero-card'

export type ActivitiesRailProps = {
  trip: Trip
}

// Total peek kept visible past the active card, split evenly on both sides so the active card is
// centered with the previous + next cards peeking left and right. Kept in sync with the width
// formula + the list's paddingHorizontal (PEEK/2) in ActivitiesRail below.
const PEEK = 72
// Keeps the teaser short - the full list lives behind "See all".
const MAX_POIS = 10

// Reanimated's ScrollView: needed for the shared scroll position driving the card scale + dots.
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

function isFiniteCoord(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

type ActivityCardProps = {
  poi: Poi
  index: number
  width: number
  interval: number
  scrollX: SharedValue<number>
  inPlan: boolean
  onPress: () => void
}

// One carousel card: scales down slightly as it drifts away from its own snap offset, driven
// purely by the shared scroll position. Transform only (no layout jump), so it's safe on a plain
// (non-recycling) ScrollView with up to MAX_POIS instances mounted at once.
function ActivityCard({
  poi,
  index,
  width,
  interval,
  scrollX,
  inPlan,
  onPress,
}: ActivityCardProps) {
  const cardStyle = useAnimatedStyle(() => {
    const offset = index * interval
    const scale = interpolate(
      scrollX.value,
      [offset - interval, offset, offset + interval],
      [0.94, 1, 0.94],
      Extrapolation.CLAMP,
    )
    return { transform: [{ scale }] }
  })

  return (
    <Animated.View style={cardStyle}>
      <PoiHeroCard poi={poi} width={width} inPlan={inPlan} onPress={onPress} />
    </Animated.View>
  )
}

type RailDotProps = {
  index: number
  interval: number
  scrollX: SharedValue<number>
}

// A dot in the position indicator below the rail: widens and gains opacity as its own card
// becomes active. Purely decorative - the row hides itself from screen readers.
function RailDot({ index, interval, scrollX }: RailDotProps) {
  const dotStyle = useAnimatedStyle(() => {
    const offset = index * interval
    const progress = interpolate(
      scrollX.value,
      [offset - interval, offset, offset + interval],
      [0, 1, 0],
      Extrapolation.CLAMP,
    )
    return {
      width: interpolate(progress, [0, 1], [6, 18]),
      opacity: interpolate(progress, [0, 1], [0.35, 1]),
    }
  })

  return <Animated.View testID="activities-rail-dot" style={[styles.dot, dotStyle]} />
}

// Cockpit teaser for the /activities screen: a horizontal carousel of the destination's top
// activities (trip interests + highlights/food), with a "See all" action through to the full
// grid. Purely additive and silent by design - it renders nothing while the trip has no
// coordinates yet, while the search is loading, or if it errors or comes back empty, so a
// still-loading or unlucky search never reads as a broken section on the cockpit.
export function ActivitiesRail({ trip }: ActivitiesRailProps) {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const { width: screenWidth } = useWindowDimensions()
  const { data: events } = useEvents(trip.id)

  // Card width fills the cockpit's inset width (theme.gap(6) on each side, matching the trip
  // screen's own horizontal padding) minus a sliver of the next card (PEEK), so the rail always
  // reads as scrollable.
  const cardWidth = Math.round(screenWidth - theme.gap(6) * 2 - PEEK)
  // The exact gap used between cards in the list style below, reused as the slider's snap
  // interval - never hardcode it separately, or the two would silently drift apart.
  const interval = cardWidth + theme.gap(3)

  const scrollX = useSharedValue(0)
  const lastSnappedIndex = useSharedValue(0)

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x
    },
    onMomentumEnd: (event) => {
      const index = Math.round(event.contentOffset.x / interval)
      if (index !== lastSnappedIndex.value) {
        lastSnappedIndex.value = index
        runOnJS(haptics.selection)()
      }
    },
  })

  const poisInput =
    isFiniteCoord(trip.latitude) && isFiniteCoord(trip.longitude)
      ? {
          lat: trip.latitude,
          lng: trip.longitude,
          includedTypes: googleTypesFor(trip.interests),
          max: MAX_POIS,
          languageCode: i18n.language === 'fr' ? 'fr' : 'en',
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

  // Generic title on purpose: destinations can be long ("Lisbonne, Portugal") and the section
  // header must stay on one line next to its "See all" action.
  const title = t('activities.title')

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
      <AnimatedScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={interval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={scrollHandler}
      >
        {pois.map((poi, index) => (
          <ActivityCard
            key={poi.placeId}
            poi={poi}
            index={index}
            width={cardWidth}
            interval={interval}
            scrollX={scrollX}
            inPlan={placeIdsInPlan.has(poi.placeId)}
            onPress={() => openActivities(poi.placeId)}
          />
        ))}
      </AnimatedScrollView>
      <View
        style={styles.dots}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {pois.map((poi, index) => (
          <RailDot key={poi.placeId} index={index} interval={interval} scrollX={scrollX} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  list: {
    gap: theme.gap(3),
    paddingTop: theme.gap(3),
    paddingBottom: theme.gap(1),
    // Center the active card: half the peek on each side so prev + next peek symmetrically.
    paddingHorizontal: PEEK / 2,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(1.5),
    paddingTop: theme.gap(1),
  },
  dot: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
}))
