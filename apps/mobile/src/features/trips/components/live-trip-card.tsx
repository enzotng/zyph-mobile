import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { AvatarStack, Badge, CityImage } from '@/components/ui'
import { eventStatus, eventTypeIcon, formatCountdown, useEvents } from '@/features/timeline'
import { PHOTO_CREAM, PHOTO_CREAM_MUTED } from '@/lib/color'
import { haptics } from '@/lib/haptics'

import type { TripCard } from '../api/trips.api'
import { daysUntil } from '../select'
import { BalancePill } from './balance-pill'

// Warm-ink vertical scrim: dark at the top (live badge + day counter), clear in the middle,
// dark at the bottom (title, members, balance, NEXT row).
const HERO_FADE_COLORS = [
  'rgba(20, 17, 12, 0.62)',
  'rgba(20, 17, 12, 0.1)',
  'rgba(20, 17, 12, 0.55)',
  'rgba(20, 17, 12, 0.9)',
] as const
const HERO_FADE_LOCATIONS = [0, 0.32, 0.6, 1] as const

type LiveTripCardProps = {
  trip: TripCard
  // Seeds the first countdown render; the card then ticks on its own so the live values stay
  // honest without the parent screen re-rendering.
  now: Date
  onPress: () => void
}

// Computes "Day N of M" from the trip's start/end dates relative to now. Day 1 is the start day;
// total is the inclusive span (end falls back to start for single-day trips). daysUntil counts
// whole local days from now to a date (negative = past), so elapsed = -daysUntil(start).
function dayProgress(trip: TripCard, now: Date): { day: number; total: number } | null {
  if (!trip.start_date) {
    return null
  }
  const end = trip.end_date ?? trip.start_date
  const elapsed = -daysUntil(trip.start_date, now)
  const startAtNoon = new Date(`${trip.start_date}T12:00:00`)
  const total = daysUntil(end, startAtNoon) + 1
  const day = Math.min(Math.max(1, elapsed + 1), Math.max(1, total))
  return { day, total: Math.max(day, total) }
}

// The home hero for an in-progress trip: a full-bleed cover with the LIVE badge + day counter,
// the title and location, members + balance, then a divider and a NEXT row built from the
// soonest upcoming timeline event. The whole card opens the trip.
export function LiveTripCard({ trip, now: initialNow, onPress }: LiveTripCardProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { data: events, isLoading } = useEvents(trip.id)

  // The card is explicitly "live", so it ticks on its own (the parent seeds the first value).
  // A 30s cadence keeps the day counter and NEXT countdown honest without per-second churn.
  const [now, setNow] = useState(initialNow)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const nowMs = now.getTime()
  const progress = dayProgress(trip, now)

  // The soonest event that has not started yet (events come back ordered by starts_at asc).
  const nextEvent = useMemo(() => {
    if (!events) {
      return null
    }
    return (
      events.find(
        (event) => event.starts_at != null && new Date(event.starts_at).getTime() >= nowMs,
      ) ?? null
    )
  }, [events, nowMs])

  const nextCountdown = useMemo(() => {
    if (!nextEvent?.starts_at) {
      return null
    }
    const status = eventStatus(nextEvent.starts_at, nextEvent.ends_at, nowMs)
    return status.kind === 'upcoming' ? formatCountdown(status, t) : null
  }, [nextEvent, nowMs, t])

  const members = trip.members.map((member) => ({
    id: member.id,
    name: member.display_name ?? undefined,
    imageUrl: member.avatar_url,
  }))

  const accessibilityLabel = [trip.title, t('home.liveNow'), trip.destination ?? undefined]
    .filter(Boolean)
    .join(', ')

  const handlePress = () => {
    haptics.light()
    onPress()
  }

  // While loading or with no upcoming event, fall back to a generic "Open trip" row.
  const showNextEvent = !isLoading && nextEvent != null

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <CityImage
        uri={trip.cover_photo_url}
        seed={trip.destination ?? trip.title}
        height={304}
        radius={theme.radius.xl}
        corners="all"
        scrim={false}
      >
        <LinearGradient
          colors={HERO_FADE_COLORS}
          locations={HERO_FADE_LOCATIONS}
          style={styles.fade}
          pointerEvents="none"
        />

        <View style={styles.topRow}>
          <Badge label={t('home.liveNow')} tone="live" icon="radio" solid />
          {progress ? (
            <Text style={styles.dayOf}>
              {t('home.dayOf', { day: progress.day, total: progress.total })}
            </Text>
          ) : null}
        </View>

        <View style={styles.bottom}>
          <Text style={styles.title} numberOfLines={1}>
            {trip.title}
          </Text>
          {trip.destination ? (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={PHOTO_CREAM_MUTED} />
              <Text style={styles.location} numberOfLines={1}>
                {trip.destination}
              </Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            {members.length > 0 ? <AvatarStack members={members} size={30} /> : <View />}
            <BalancePill cents={trip.myBalanceCents} currency={trip.currency} />
          </View>

          <View style={styles.divider} pointerEvents="none" />

          <View style={styles.nextRow}>
            {showNextEvent && nextEvent ? (
              <>
                <View style={styles.nextIcon}>
                  <Ionicons name={eventTypeIcon(nextEvent.type)} size={16} color={PHOTO_CREAM} />
                </View>
                <View style={styles.nextText}>
                  <Text style={styles.nextEyebrow} numberOfLines={1}>
                    {nextCountdown
                      ? t('home.nextIn', { countdown: nextCountdown })
                      : t('home.next')}
                  </Text>
                  <Text style={styles.nextTitle} numberOfLines={1}>
                    {nextEvent.title}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.nextIcon}>
                  <Ionicons name="map-outline" size={16} color={PHOTO_CREAM} />
                </View>
                <View style={styles.nextText}>
                  <Text style={styles.nextTitle} numberOfLines={1}>
                    {t('home.openTrip')}
                  </Text>
                </View>
              </>
            )}
            <Ionicons name="chevron-forward" size={20} color={PHOTO_CREAM_MUTED} />
          </View>
        </View>
      </CityImage>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topRow: {
    position: 'absolute',
    top: theme.gap(3.5),
    left: theme.gap(4),
    right: theme.gap(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2),
  },
  dayOf: {
    color: PHOTO_CREAM,
    fontFamily: theme.fonts.display.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  bottom: {
    position: 'absolute',
    left: theme.gap(4),
    right: theme.gap(4),
    bottom: theme.gap(4),
    gap: theme.gap(2),
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xxl,
    color: PHOTO_CREAM,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
    marginTop: -theme.gap(1),
  },
  location: {
    flexShrink: 1,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: PHOTO_CREAM_MUTED,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2),
    marginTop: theme.gap(1),
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    marginVertical: theme.gap(1),
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
  },
  nextIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  nextText: {
    flex: 1,
    gap: 2,
  },
  nextEyebrow: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.78)',
  },
  nextTitle: {
    fontFamily: theme.fonts.display.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: PHOTO_CREAM,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
}))
