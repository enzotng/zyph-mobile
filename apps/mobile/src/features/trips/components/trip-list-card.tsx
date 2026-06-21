import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { AvatarStack, Badge, CityImage } from '@/components/ui'
import { haptics } from '@/lib/haptics'
import { formatAmount } from '@/lib/money'

import type { TripCard } from '../api/trips.api'
import { formatTripDates } from '../format'

const FADE_COLORS = [
  'rgba(20, 17, 12, 0)',
  'rgba(20, 17, 12, 0.55)',
  'rgba(20, 17, 12, 0.92)',
] as const
const FADE_LOCATIONS = [0, 0.5, 1] as const

type TripListCardProps = {
  trip: TripCard
  onPress: () => void
}

// Full-width trip card for the "all trips" list: a full-bleed cover with a bottom fade the
// title, location, member avatars, dates and balance rest on (no solid footer).
export function TripListCard({ trip, onPress }: TripListCardProps) {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()

  const balance = trip.myBalanceCents
  const tone = balance > 0 ? 'success' : balance < 0 ? 'destructive' : 'muted'
  const balanceLabel =
    balance > 0
      ? t('trips.owed', { amount: formatAmount(balance, trip.currency) })
      : balance < 0
        ? t('trips.owe', { amount: formatAmount(Math.abs(balance), trip.currency) })
        : t('trips.settled')

  const dates = formatTripDates(trip.start_date, trip.end_date, i18n.language)
  const members = trip.members.map((member) => ({
    id: member.id,
    name: member.display_name ?? undefined,
    imageUrl: member.avatar_url,
  }))

  const handlePress = () => {
    haptics.light()
    onPress()
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={trip.title}
    >
      <CityImage
        uri={trip.cover_photo_url}
        seed={trip.destination ?? trip.title}
        height={184}
        radius={theme.radius.lg}
        corners="all"
        scrim={false}
      >
        <LinearGradient
          colors={FADE_COLORS}
          locations={FADE_LOCATIONS}
          style={styles.fade}
          pointerEvents="none"
        />
        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.titleCol}>
              <Text style={styles.title} numberOfLines={1}>
                {trip.title}
              </Text>
              {trip.destination ? (
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={13} color="rgba(255, 255, 255, 0.9)" />
                  <Text style={styles.location} numberOfLines={1}>
                    {trip.destination}
                  </Text>
                </View>
              ) : null}
            </View>
            {members.length > 0 ? <AvatarStack members={members} size={26} /> : null}
          </View>
          <View style={styles.bottomRow}>
            {dates ? (
              <View style={styles.datesRow}>
                <Ionicons name="calendar-outline" size={13} color="rgba(255, 255, 255, 0.85)" />
                <Text style={styles.dates}>{dates}</Text>
              </View>
            ) : (
              <View />
            )}
            <Badge label={balanceLabel} tone={tone} />
          </View>
        </View>
      </CityImage>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  cardWrap: {
    marginBottom: theme.gap(3.5),
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
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
    gap: theme.gap(2),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(3.5),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.gap(2.5),
  },
  titleCol: {
    flexShrink: 1,
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
    marginTop: 2,
  },
  location: {
    flexShrink: 1,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2.5),
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
  },
  dates: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.85)',
  },
}))
