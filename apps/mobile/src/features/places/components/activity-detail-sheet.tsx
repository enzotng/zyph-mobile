import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import type { TFunction } from 'i18next'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Badge, BottomSheet, Button, Chip, ListRow, Surface } from '@/components/ui'
import { formatEventDay, type NewItineraryEvent, useCreateEvents } from '@/features/timeline'
import { dateToIsoDay, isoDayToDate, type Trip } from '@/features/trips'
import { useCreatePoi } from '@/features/wayfinder'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

import { usePoiPhoto } from '../hooks/use-poi-photo'
import type { Poi } from '../poi.types'
import { formatPriceRange } from '../price'
import { formatCount } from './poi-card'

export type ActivityDetailSheetProps = {
  poi: Poi | null // null = closed
  trip: Trip // dates for the day picker, id for mutations
  categoryLabel?: string
  inPlan: boolean // an event with this place_id already exists
  onClose: () => void
}

// The default icon used by the manual "add a waypoint" form (pois/new.tsx) - mirrored here so
// a saved activity looks the same as a hand-added one.
const WAYPOINT_ICON = 'pin'

// The day chip row is capped so a long trip never turns into an unusable horizontal scroll.
const MAX_TRIP_DAYS = 21

// Buckets a Google Places type list into a canonical timeline event type. Pure + exported so
// the next task's screen (and this file's tests) can reuse it.
export function mapPoiType(types: string[]): 'food' | 'lodging' | 'activity' {
  if (types.some((type) => ['restaurant', 'cafe', 'bar', 'bakery', 'food'].includes(type))) {
    return 'food'
  }
  if (types.some((type) => ['lodging', 'hotel'].includes(type))) {
    return 'lodging'
  }
  return 'activity'
}

// A real price range string ("10-20 EUR"), a one-sided "from"/"up to" string when only one bound
// is known, or null when neither bound is known - in which case the caller falls back to the
// '$'.repeat price-level display. Pure + exported so this file's tests can exercise it directly.
export function formatPriceRange(poi: Poi, t: TFunction): string | null {
  const { priceStart, priceEnd, priceCurrency } = poi
  if (priceStart === null && priceEnd === null) {
    return null
  }
  const currency = priceCurrency ? ` ${priceCurrency}` : ''
  if (priceStart !== null && priceEnd !== null) {
    return `${priceStart}-${priceEnd}${currency}`
  }
  if (priceStart !== null) {
    return t('activities.priceFrom', { price: `${priceStart}${currency}` })
  }
  return t('activities.priceUpTo', { price: `${priceEnd}${currency}` })
}

// The trip's calendar days (start..end inclusive, local calendar), capped at MAX_TRIP_DAYS.
function tripDays(trip: Trip): string[] {
  if (!trip.start_date) {
    return []
  }
  const end = isoDayToDate(trip.end_date ?? trip.start_date)
  const cursor = isoDayToDate(trip.start_date)
  const days: string[] = []
  while (cursor.getTime() <= end.getTime() && days.length < MAX_TRIP_DAYS) {
    days.push(dateToIsoDay(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

// Today when it is one of the chips, otherwise the first day - or null when there are no days.
function defaultDay(days: string[]): string | null {
  if (days.length === 0) {
    return null
  }
  const today = dateToIsoDay(new Date())
  return days.includes(today) ? today : days[0]
}

// Selected day at noon local time (mirrors the itinerary block's own event construction), or
// "now" when the trip has no dates at all.
function startsAtFor(day: string | null): string {
  return day ? new Date(`${day}T12:00:00`).toISOString() : new Date().toISOString()
}

export function ActivityDetailSheet({
  poi,
  trip,
  categoryLabel,
  inPlan,
  onClose,
}: ActivityDetailSheetProps): React.JSX.Element | null {
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()

  const days = useMemo(() => tripDays(trip), [trip])

  // Keeps rendering the last opened place while the sheet slides closed, and tracks which
  // place the CURRENT open session belongs to so the "Added"/"Saved" state (and the day
  // selection) reset every time the sheet opens - even when it is the same place again.
  const [activePoi, setActivePoi] = useState<Poi | null>(poi)
  const [sessionPoiId, setSessionPoiId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(() => defaultDay(days))
  const [added, setAdded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hoursExpanded, setHoursExpanded] = useState(false)

  if (poi && poi.placeId !== sessionPoiId) {
    setSessionPoiId(poi.placeId)
    setActivePoi(poi)
    setSelectedDay(defaultDay(days))
    setAdded(false)
    setSaved(false)
    setHoursExpanded(false)
  } else if (!poi && sessionPoiId !== null) {
    setSessionPoiId(null)
    setHoursExpanded(false)
  }

  const { data: photoUri } = usePoiPhoto(activePoi?.photoName ?? null, 1200)
  const createEvents = useCreateEvents()
  const createPoi = useCreatePoi(trip.id)

  if (!activePoi) {
    return null
  }

  async function handleAddToTimeline() {
    if (!activePoi) {
      return
    }
    const event: NewItineraryEvent = {
      title: activePoi.name,
      type: mapPoiType(activePoi.types),
      startsAt: startsAtFor(selectedDay),
      lat: activePoi.lat,
      lng: activePoi.lng,
      placeId: activePoi.placeId,
    }
    try {
      await createEvents.mutateAsync({ tripId: trip.id, events: [event] })
      haptics.success()
      setAdded(true)
    } catch {
      haptics.error()
      Alert.alert(t('errors.title'), t('common.tryAgain'))
    }
  }

  async function handleSaveWaypoint() {
    if (!activePoi) {
      return
    }
    try {
      await createPoi.mutateAsync({
        tripId: trip.id,
        label: activePoi.name,
        icon: WAYPOINT_ICON,
        lat: activePoi.lat,
        lng: activePoi.lng,
      })
      haptics.success()
      setSaved(true)
    } catch {
      haptics.error()
      Alert.alert(t('errors.title'), t('common.tryAgain'))
    }
  }

  const typeChipLabel = activePoi.typeLabel ?? categoryLabel
  const priceRangeLabel = formatPriceRange(activePoi, t)

  return (
    <BottomSheet open={poi !== null} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
        ) : (
          <Surface
            radius={theme.radius.lg}
            borderWidth={0}
            color={withAlpha(theme.colors.muted, 0.1)}
            style={styles.photo}
          />
        )}

        <Text style={styles.name}>{activePoi.name}</Text>

        {activePoi.rating !== null ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {`★ ${activePoi.rating}`}
              {activePoi.ratingCount !== null ? ` (${formatCount(activePoi.ratingCount)})` : ''}
            </Text>
          </View>
        ) : null}

        {typeChipLabel ? (
          <View style={styles.badgeRow}>
            <Badge label={typeChipLabel} tone="primary" />
          </View>
        ) : null}

        {activePoi.description ? (
          <Text style={styles.description} numberOfLines={4}>
            {activePoi.description}
          </Text>
        ) : null}

        {priceRangeLabel ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{priceRangeLabel}</Text>
          </View>
        ) : activePoi.priceLevel !== null ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{'$'.repeat(activePoi.priceLevel + 1)}</Text>
          </View>
        ) : null}

        {activePoi.weekdayHours ? (
          <View style={styles.hoursSection}>
            <ListRow
              title={t('activities.hours')}
              onPress={() => setHoursExpanded((expanded) => !expanded)}
              accessibilityState={{ expanded: hoursExpanded }}
              right={
                <Ionicons
                  name={hoursExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={theme.colors.muted}
                />
              }
            />
            {hoursExpanded ? (
              <View style={styles.hoursList}>
                {activePoi.weekdayHours.map((line) => (
                  <Text key={line} style={styles.hoursLine}>
                    {line}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {activePoi.address ? (
          <Text style={styles.address} numberOfLines={2}>
            {activePoi.address}
          </Text>
        ) : null}

        {activePoi.openNow !== null ? (
          <Text style={[styles.openLabel, activePoi.openNow ? styles.open : styles.closed]}>
            {activePoi.openNow ? t('activities.open') : t('activities.closed')}
          </Text>
        ) : null}

        {inPlan ? (
          <View style={styles.badgeRow}>
            <Badge label={t('activities.inPlan')} tone="success" icon="checkmark-circle" />
          </View>
        ) : null}

        {days.length > 0 ? (
          <View style={styles.dayPicker}>
            <Text style={styles.pickDayLabel}>{t('activities.pickDay')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayChips}
            >
              {days.map((day) => (
                <Chip
                  key={day}
                  label={formatEventDay(`${day}T12:00:00`, i18n.language, t('timeline.noDate'))}
                  selected={selectedDay === day}
                  onPress={() => setSelectedDay(day)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={added ? t('activities.added') : t('activities.addToTimeline')}
            onPress={() => void handleAddToTimeline()}
            disabled={added}
            loading={createEvents.isPending}
          />
          <Button
            label={saved ? t('activities.saved') : t('activities.saveWaypoint')}
            variant="secondary"
            onPress={() => void handleSaveWaypoint()}
            disabled={saved}
            loading={createPoi.isPending}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create((theme) => ({
  photo: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.lg,
    marginBottom: theme.gap(3),
  },
  name: {
    fontSize: theme.fontSize.lg,
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    color: theme.colors.foreground,
    marginBottom: theme.gap(2),
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
    alignItems: 'center',
    marginBottom: theme.gap(2),
  },
  metaText: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
  },
  description: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
    marginBottom: theme.gap(2),
  },
  address: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
    marginBottom: theme.gap(2),
  },
  openLabel: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    marginBottom: theme.gap(2),
  },
  open: {
    color: theme.colors.success,
  },
  closed: {
    color: theme.colors.destructive,
  },
  badgeRow: {
    alignItems: 'flex-start',
    marginBottom: theme.gap(2),
  },
  hoursSection: {
    marginBottom: theme.gap(2),
  },
  hoursList: {
    gap: theme.gap(1),
    paddingTop: theme.gap(1),
    paddingBottom: theme.gap(2),
  },
  hoursLine: {
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
  },
  dayPicker: {
    gap: theme.gap(2),
    marginTop: theme.gap(2),
    marginBottom: theme.gap(4),
  },
  pickDayLabel: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  dayChips: {
    flexDirection: 'row',
    gap: theme.gap(2),
  },
  actions: {
    gap: theme.gap(2),
  },
}))
