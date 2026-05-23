import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { poiIconName } from '@/components/poi-icon-picker'
import type { LatLng } from '@/lib/geo'
import { bearing, formatDistance, haversine, projectToScreen, relativeHeading } from '@/lib/geo'

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
        const inFov = projection.visible
        const scale = Math.max(0.55, Math.min(1, projection.scale))

        if (!inFov) {
          // Off-screen indicator at the closest screen edge.
          const offX = delta > 0 ? width - 28 : 4
          const offY = height / 2 - 8
          return (
            <View
              key={target.id}
              style={[styles.edgeDot, { left: offX, top: offY }]}
              accessibilityLabel={`${target.label} off-screen`}
            />
          )
        }

        const size = 28 * scale + (isActive ? 8 : 0)
        const half = size / 2
        return (
          <View
            key={target.id}
            style={[styles.marker, { left: projection.x - half, top: projection.y - half }]}
          >
            <View
              style={[
                styles.dot,
                {
                  width: size,
                  height: size,
                  borderRadius: half,
                },
                isActive ? styles.dotActive : styles.dotIdle,
              ]}
            >
              <Ionicons
                name={poiIconName(target.icon)}
                size={Math.max(12, size * 0.55)}
                color={isActive ? '#FFFFFF' : '#0F172A'}
              />
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillLabel} numberOfLines={1}>
                {target.label}
              </Text>
              <Text style={styles.pillDistance}>{formatDistance(distance)}</Text>
            </View>
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
    alignItems: 'center',
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dotIdle: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(0,0,0,0.35)',
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    borderColor: '#FFFFFF',
  },
  pill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    maxWidth: 160,
  },
  pillLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  pillDistance: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  edgeDot: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD15A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
}))
