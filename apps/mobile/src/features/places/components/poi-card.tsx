import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Badge, Surface } from '@/components/ui'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

import { usePoiPhoto } from '../hooks/use-poi-photo'
import type { Poi } from '../poi.types'

export type PoiCardProps = {
  poi: Poi
  // Small chip text (e.g. the active category); omit to hide.
  categoryLabel?: string
  // Shows the "In your plan" badge when the POI is already on the trip's itinerary.
  inPlan?: boolean
  onPress: () => void
  // Fixed width for carousel usage; default flex (grid usage).
  width?: number
}

// Compact rating-count label, e.g. 12 345 -> '12k', 2 500 000 -> '2M'. Pure, no rounding beyond
// truncation, so the value never reads as more precise than it is.
export function formatCount(count: number): string {
  if (count < 1000) {
    return String(count)
  }
  if (count < 1_000_000) {
    return `${Math.floor(count / 1000)}k`
  }
  return `${Math.floor(count / 1_000_000)}M`
}

// Rich place card used in both a grid (default flex width) and a horizontal carousel (fixed
// width). Matches the trips *-card.tsx Surface/Unistyles conventions.
export function PoiCard({ poi, categoryLabel, inPlan = false, onPress, width }: PoiCardProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { data: photoUri } = usePoiPhoto(poi.photoName)

  const handlePress = () => {
    haptics.selection()
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={poi.name}
      style={({ pressed }) => [
        styles.card,
        width ? { width } : styles.flex,
        pressed && styles.pressed,
      ]}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
      ) : (
        <Surface
          radius={theme.radius.lg}
          corners="top"
          borderWidth={0}
          color={withAlpha(theme.colors.muted, 0.1)}
          style={styles.photo}
        />
      )}

      <View style={styles.body}>
        {categoryLabel ? (
          <Text style={styles.category} numberOfLines={1}>
            {categoryLabel}
          </Text>
        ) : null}

        <Text style={styles.name} numberOfLines={2}>
          {poi.name}
        </Text>

        {poi.rating !== null || poi.priceLevel !== null ? (
          <View style={styles.metaRow}>
            {poi.rating !== null ? (
              <Text style={styles.metaText}>
                {`★ ${poi.rating}`}
                {poi.ratingCount !== null ? ` (${formatCount(poi.ratingCount)})` : ''}
              </Text>
            ) : null}
            {poi.priceLevel !== null ? (
              <Text style={styles.metaText}>{'$'.repeat(poi.priceLevel + 1)}</Text>
            ) : null}
          </View>
        ) : null}

        {inPlan ? (
          <View style={styles.badgeRow}>
            <Badge label={t('activities.inPlan')} tone="success" icon="checkmark-circle" />
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  card: {
    minHeight: 44,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  photo: {
    width: '100%',
    height: 120,
  },
  body: {
    gap: theme.gap(1),
    padding: theme.gap(3),
  },
  category: {
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
    alignItems: 'center',
  },
  metaText: {
    fontSize: theme.fontSize.xs,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
  },
  badgeRow: {
    alignItems: 'flex-start',
  },
}))
