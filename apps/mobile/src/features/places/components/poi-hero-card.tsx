import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet as RNStyleSheet, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Badge, Surface } from '@/components/ui'
import { PHOTO_CREAM, PHOTO_CREAM_MUTED, withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

import { usePoiPhoto } from '../hooks/use-poi-photo'
import type { Poi } from '../poi.types'
import { formatPriceRange } from '../price'
import { formatCount } from './poi-card'

export type PoiHeroCardProps = {
  poi: Poi
  // Card width; height follows a fixed 3:2 ratio.
  width: number
  // Shows the "In your plan" badge when the POI is already on the trip's itinerary.
  inPlan?: boolean
  onPress: () => void
}

// The card sits directly on its own photo behind a dark scrim, so on-photo text uses the app's
// fixed photo-overlay tones (PHOTO_CREAM, shared with NextDepartureCard/TripListCard/CityImage)
// rather than theme colors: light and legible on a photo in both themes. AMBER is the one local
// accent (the rating star), fixed for the same reason.
const AMBER = '#F5B84B'

// Large "poster" card for the cockpit rail: the photo fills the whole card and the name, rating
// and price sit on a bottom gradient scrim. Rail-only - the /activities grid keeps the compact
// PoiCard.
export function PoiHeroCard({ poi, width, inPlan = false, onPress }: PoiHeroCardProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { data: photoUri } = usePoiPhoto(poi.photoName)

  const handlePress = () => {
    haptics.selection()
    onPress()
  }

  const priceRangeLabel = formatPriceRange(poi, t)
  const priceLabel =
    priceRangeLabel ?? (poi.priceLevel !== null ? '$'.repeat(poi.priceLevel + 1) : null)

  const height = Math.round(width * 0.66)

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={poi.name}
      style={({ pressed }) => [styles.card, { width, height }, pressed && styles.pressed]}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={RNStyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Surface
          radius={theme.radius.lg}
          borderWidth={0}
          color={withAlpha(theme.colors.muted, 0.1)}
          style={RNStyleSheet.absoluteFill}
        />
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0, 0, 0, 0.72)']}
        style={styles.scrim}
        pointerEvents="none"
      />

      {inPlan ? (
        <View style={styles.badgeWrap}>
          <Badge label={t('activities.inPlan')} tone="success" icon="checkmark-circle" />
        </View>
      ) : null}

      <View style={styles.textBlock}>
        {poi.typeLabel ? (
          <Text style={styles.eyebrow} numberOfLines={1}>
            {poi.typeLabel.toUpperCase()}
          </Text>
        ) : null}

        <Text style={styles.name} numberOfLines={2}>
          {poi.name}
        </Text>

        {poi.rating !== null || priceLabel ? (
          <View style={styles.metaRow}>
            {poi.rating !== null ? (
              <View style={styles.ratingGroup}>
                <Ionicons name="star" size={12} color={AMBER} />
                <Text style={styles.ratingText}>
                  {poi.rating}
                  {poi.ratingCount !== null ? ` (${formatCount(poi.ratingCount)})` : ''}
                </Text>
              </View>
            ) : null}
            {priceLabel ? <Text style={styles.priceText}>{priceLabel}</Text> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  badgeWrap: {
    position: 'absolute',
    top: theme.gap(2),
    right: theme.gap(2),
    borderRadius: theme.radius.full,
    // A subtle dark halo behind the badge's own translucent success fill, so it stays legible
    // over a bright patch of photo.
    backgroundColor: withAlpha('#000000', 0.35),
    padding: 2,
  },
  textBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: theme.gap(1),
    padding: theme.gap(3),
  },
  eyebrow: {
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: PHOTO_CREAM_MUTED,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: theme.fontSize.lg,
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    color: PHOTO_CREAM,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  ratingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
  },
  ratingText: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: PHOTO_CREAM,
  },
  priceText: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.regular,
    color: PHOTO_CREAM,
  },
}))
