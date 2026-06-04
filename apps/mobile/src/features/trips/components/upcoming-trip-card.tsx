import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { CityImage, StatusDot } from '@/components/ui'

import type { TripCard } from '../api/trips.api'
import { formatTripDates } from '../format'
import type { StatusTone } from '../select'

// Smooth dark fade (transparent at the top -> dark at the bottom) the text sits on.
const FADE_COLORS = [
  'rgba(15, 23, 42, 0)',
  'rgba(15, 23, 42, 0.55)',
  'rgba(15, 23, 42, 0.92)',
] as const
const FADE_LOCATIONS = [0, 0.5, 1] as const

type UpcomingTripCardProps = {
  trip: TripCard
  tone: StatusTone
  onPress: () => void
}

// Compact half-width card: a full-bleed cover with a status dot and a bottom fade the title
// and dates rest on (no solid footer).
export function UpcomingTripCard({ trip, tone, onPress }: UpcomingTripCardProps) {
  const { theme } = useUnistyles()
  const { i18n } = useTranslation()
  const dates = formatTripDates(trip.start_date, trip.end_date, i18n.language)

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={trip.title}
    >
      <CityImage
        uri={trip.cover_photo_url}
        seed={trip.destination ?? trip.title}
        height={156}
        radius={theme.radius.lg}
        corners="all"
        scrim={false}
      >
        <View style={styles.dot}>
          <StatusDot tone={tone} />
        </View>
        <LinearGradient
          colors={FADE_COLORS}
          locations={FADE_LOCATIONS}
          style={styles.fade}
          pointerEvents="none"
        />
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {trip.title}
          </Text>
          {dates ? (
            <View style={styles.datesRow}>
              <Ionicons name="calendar-outline" size={12} color="rgba(255, 255, 255, 0.85)" />
              <Text style={styles.dates} numberOfLines={1}>
                {dates}
              </Text>
            </View>
          ) : null}
        </View>
      </CityImage>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  dot: {
    position: 'absolute',
    top: theme.gap(2),
    right: theme.gap(2),
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '72%',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: theme.gap(1),
    paddingVertical: theme.gap(2.5),
    paddingHorizontal: theme.gap(3),
  },
  title: {
    fontFamily: theme.fonts.display.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
  },
  dates: {
    flexShrink: 1,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: 'rgba(255, 255, 255, 0.85)',
  },
}))
