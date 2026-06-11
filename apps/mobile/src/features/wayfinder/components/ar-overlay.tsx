import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { poiIconName } from '@/components/poi-icon-picker'
import type { LatLng } from '@/lib/geo'
import {
  bearing,
  formatDistance,
  formatWalkingTime,
  haversine,
  projectToScreen,
  relativeHeading,
} from '@/lib/geo'

import type { WayfinderTarget } from '../hooks/use-wayfinder-targets'

type Props = {
  width: number
  height: number
  user: LatLng | null
  heading: number
  pitch: number
  targets: WayfinderTarget[]
  activeId: string | null
}

// Fixed-width marker container so the disc + card stay centred on the projected point
// whatever the label length.
const CARD_W = 172
// Beyond this distance we only show the icon disc (no text card): far POIs cannot be placed
// precisely with compass+GPS, so we avoid visibly mislabelling a distant building.
const CARD_MAX_DISTANCE_M = 200
// Distance fade: near targets are solid, far ones recede toward MIN_OPACITY.
const FADE_NEAR_M = 50
const FADE_FAR_M = 350
const MIN_OPACITY = 0.35

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// Depth cue: closer = opaque, farther = translucent (active target stays solid).
function distanceOpacity(distance: number): number {
  const t = clamp((distance - FADE_NEAR_M) / (FADE_FAR_M - FADE_NEAR_M), 0, 1)
  return 1 - t * (1 - MIN_OPACITY)
}

export function ArOverlay({ width, height, user, heading, pitch, targets, activeId }: Props) {
  const items = useMemo(() => {
    if (!user) return []
    return targets
      .map((target) => {
        const distance = haversine(user, target)
        const targetBearing = bearing(user, target)
        const delta = relativeHeading(targetBearing, heading)
        const projection = projectToScreen(user, target, { heading, pitch }, { width, height })
        return { target, distance, delta, projection }
      })
      .sort((a, b) => b.distance - a.distance)
  }, [user, targets, heading, pitch, width, height])

  if (!user) {
    return null
  }

  return (
    <View pointerEvents="none" style={styles.root}>
      {items.map(({ target, distance, delta, projection }) => {
        const isActive = target.id === activeId

        if (!projection.visible) {
          // Off-screen target: a chevron at the nearest edge pointing the way to turn.
          const onRight = delta > 0
          return (
            <View
              key={target.id}
              style={[
                styles.edge,
                isActive && styles.edgeActive,
                { top: height / 2 - 20 },
                onRight ? styles.edgeRight : styles.edgeLeft,
              ]}
              accessibilityLabel={`${target.label} off-screen`}
            >
              <Ionicons
                name={onRight ? 'chevron-forward' : 'chevron-back'}
                size={22}
                color={isActive ? '#FFFFFF' : '#FFD15A'}
              />
            </View>
          )
        }

        const scale = clamp(projection.scale, 0.5, 1.15)
        const discSize = Math.round(30 * scale) + (isActive ? 6 : 0)
        const opacity = isActive ? 1 : distanceOpacity(distance)
        const showCard = isActive || distance <= CARD_MAX_DISTANCE_M

        return (
          <View
            key={target.id}
            style={[
              styles.marker,
              { left: projection.x - CARD_W / 2, top: projection.y - discSize / 2, opacity },
            ]}
          >
            <View
              style={[
                styles.disc,
                { width: discSize, height: discSize, borderRadius: discSize / 2 },
                isActive ? styles.discActive : styles.discIdle,
              ]}
            >
              <Ionicons
                name={poiIconName(target.icon)}
                size={Math.max(13, Math.round(discSize * 0.52))}
                color={isActive ? '#FFFFFF' : '#0F172A'}
              />
            </View>
            {showCard ? (
              <View style={[styles.card, isActive && styles.cardActive]}>
                <Text style={styles.cardLabel} numberOfLines={1}>
                  {target.label}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardMetaText}>{formatDistance(distance)}</Text>
                  <Text style={styles.cardMetaDot}>·</Text>
                  <Text style={styles.cardMetaText}>{formatWalkingTime(distance)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    position: 'absolute',
    width: CARD_W,
    alignItems: 'center',
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  discIdle: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: 'rgba(255,255,255,0.85)',
  },
  discActive: {
    backgroundColor: theme.colors.primary,
    borderColor: '#FFFFFF',
  },
  card: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    maxWidth: CARD_W,
  },
  cardActive: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderColor: theme.colors.primary,
  },
  cardLabel: {
    color: '#FFFFFF',
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: 13,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  cardMetaText: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: theme.fonts.sans.medium,
    fontSize: 11,
  },
  cardMetaDot: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
  },
  edge: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  edgeActive: {
    backgroundColor: theme.colors.primary,
    borderColor: '#FFFFFF',
  },
  edgeLeft: {
    left: 8,
  },
  edgeRight: {
    right: 8,
  },
}))
