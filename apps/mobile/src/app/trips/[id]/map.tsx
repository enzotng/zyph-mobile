import { AppleMaps } from 'expo-maps'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { Surface } from '@/components/ui'
import {
  layerOf,
  type MapLayer,
  mapSymbolFor,
  mapTintFor,
  useWayfinderTargets,
} from '@/features/wayfinder'
import { paramString } from '@/lib/routing'

const LAYERS: MapLayer[] = ['event', 'poi', 'member']

export default function TripMapScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  const [visible, setVisible] = useState<Record<MapLayer, boolean>>({
    event: true,
    poi: true,
    member: true,
  })

  // member polling only runs while the member layer is on (drives includeMembers).
  const { targets } = useWayfinderTargets(tripId, visible.member)

  const markers = useMemo(
    () =>
      targets
        .filter((target) => visible[layerOf(target.kind)])
        .map((target) => ({
          id: target.id,
          coordinates: { latitude: target.lat, longitude: target.lng },
          title: target.label,
          systemImage: mapSymbolFor(target.kind, target.icon),
          tintColor: mapTintFor(theme.colors, target.kind),
        })),
    [targets, visible, theme],
  )

  if (Platform.OS !== 'ios') {
    return (
      <Screen title={t('map.title')} showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('map.iosOnly')}</Text>
        </View>
      </Screen>
    )
  }

  if (targets.length === 0) {
    return (
      <Screen title={t('map.title')} showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('map.empty')}</Text>
        </View>
      </Screen>
    )
  }

  function toggleLayer(layer: MapLayer) {
    setVisible((prev) => ({ ...prev, [layer]: !prev[layer] }))
  }

  return (
    <Screen title={t('map.title')} showBack>
      <View style={styles.mapWrap} accessibilityLabel={t('map.title')}>
        <AppleMaps.View
          style={styles.map}
          cameraPosition={
            markers.length ? { coordinates: markers[0].coordinates, zoom: 11 } : undefined
          }
          markers={markers}
          onMarkerClick={(marker) => {
            if (!marker.id) {
              return
            }
            const [kind, sourceId] = marker.id.split(':')
            if ((kind === 'event' || kind === 'gate') && sourceId) {
              router.push({
                pathname: '/trips/[id]/events/[eventId]',
                params: { id: tripId, eventId: sourceId },
              })
            }
          }}
        />
        <View style={styles.legend} pointerEvents="box-none">
          {LAYERS.map((layer) => {
            const on = visible[layer]
            return (
              <Pressable
                key={layer}
                onPress={() => toggleLayer(layer)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Surface
                  radius={theme.radius.full}
                  color={theme.colors.background}
                  borderColor={theme.colors.border}
                  borderWidth={1}
                  style={[styles.chip, !on && styles.chipOff]}
                >
                  <View
                    style={[styles.dot, { backgroundColor: mapTintFor(theme.colors, layer) }]}
                  />
                  <Text style={styles.chipLabel}>{t(`map.layers.${layer}s`)}</Text>
                </Surface>
              </Pressable>
            )
          })}
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    textAlign: 'center',
    color: theme.colors.muted,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
  },
  mapWrap: {
    flex: 1,
    marginBottom: rt.insets.bottom + theme.gap(2),
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
  },
  map: {
    flex: 1,
  },
  legend: {
    position: 'absolute',
    top: theme.gap(3),
    left: theme.gap(3),
    right: theme.gap(3),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(1.5),
    paddingHorizontal: theme.gap(3),
  },
  chipOff: {
    opacity: 0.45,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
}))
