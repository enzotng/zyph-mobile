import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { CityImage, Surface } from '@/components/ui'
import { haptics } from '@/lib/haptics'

import type { TripCard } from '../api/trips.api'
import { daysUntil } from '../select'

type UpcomingTripRowProps = {
  trip: TripCard
  now: Date
  onPress: () => void
}

// A single full-width upcoming-trip row: a Surface (border, no shadow) with a small photo
// thumbnail, the title and a "<destination>, in N days" line, and a trailing chevron.
export function UpcomingTripRow({ trip, now, onPress }: UpcomingTripRowProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()

  const destination = trip.destination ?? trip.title
  const days = trip.start_date ? daysUntil(trip.start_date, now) : null
  const meta =
    days == null
      ? destination
      : days <= 0
        ? t('home.rowToday', { destination })
        : t('home.rowInDays', { destination, count: days })

  const handlePress = () => {
    haptics.light()
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={trip.title}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <Surface radius={theme.radius.lg} style={styles.row}>
        <CityImage
          uri={trip.cover_photo_url}
          seed={trip.destination ?? trip.title}
          height={46}
          radius={13}
          corners="all"
          scrim={false}
          style={styles.thumb}
        />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {trip.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
      </Surface>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2.5),
    paddingHorizontal: theme.gap(3),
  },
  thumb: {
    width: 46,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: theme.fonts.display.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
    letterSpacing: -0.2,
  },
  meta: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
}))
