import { Ionicons } from '@expo/vector-icons'
import { AppleMaps } from 'expo-maps'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { Badge, BottomSheet, Surface } from '@/components/ui'
import {
  layerOf,
  type MapLayer,
  mapSymbolFor,
  mapTintFor,
  useWayfinderTargets,
  type WayfinderTarget,
  type WayfinderTargetKind,
} from '@/features/wayfinder'
import { formatDistance, formatWalkingTime, haversine } from '@/lib/geo'
import { paramString } from '@/lib/routing'
import { useUserLocation } from '@/lib/sensors'

const LAYERS: MapLayer[] = ['event', 'poi', 'member']
// Disable ALL of MapKit's default top-right controls (my-location button, compass, pitch toggle,
// scale bar) so none collide with our own UI; the blue user dot stays via isMyLocationEnabled.
const MAP_UI_SETTINGS = {
  myLocationButtonEnabled: false,
  compassEnabled: false,
  togglePitchEnabled: false,
  scaleBarEnabled: false,
} as const
// Per-day route colours (cycled); first few align with the brand palette.
const DAY_COLORS = ['#6366F1', '#38BDF8', '#10B981', '#F59E0B', '#EF4444', '#A855F7', '#EC4899']
// Approx width the bottom-right cluster occupies, reserved as day-bar right padding.
const CLUSTER_FOOTPRINT = 56

type Coords = { latitude: number; longitude: number }
type DayGroup = { key: string; label: string; targets: WayfinderTarget[] }

function dayColor(index: number): string {
  return DAY_COLORS[index % DAY_COLORS.length]
}

// Local calendar-day key (YYYY-MM-DD) so events group by the user's day, not UTC.
function dayKeyOf(iso: string): string {
  const d = new Date(iso)
  const month = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// Frame a camera on a set of coordinates (no fit-to-bounds in expo-maps, so derive a centre +
// a span-based zoom). Tight for a single point, wider as the set spreads out.
function frameCamera(coords: Coords[]): { coordinates: Coords; zoom: number } | undefined {
  if (coords.length === 0) {
    return undefined
  }
  const lats = coords.map((c) => c.latitude)
  const lngs = coords.map((c) => c.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const coordinates = { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 }
  const span = Math.max(maxLat - minLat, maxLng - minLng)
  const zoom = span < 0.005 ? 14 : Math.max(3, Math.min(15, Math.round(Math.log2(360 / span)) - 1))
  return { coordinates, zoom }
}

function cameraFor(targets: WayfinderTarget[]) {
  return frameCamera(targets.map((target) => ({ latitude: target.lat, longitude: target.lng })))
}

function badgeTone(kind: WayfinderTargetKind): 'primary' | 'success' | 'muted' {
  if (kind === 'member') {
    return 'success'
  }
  if (kind === 'poi') {
    return 'muted'
  }
  return 'primary'
}

function isEventKind(kind: WayfinderTargetKind): boolean {
  return kind === 'event' || kind === 'gate'
}

export default function TripMapScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { t } = useTranslation()
  const { theme, rt } = useUnistyles()

  const [visible, setVisible] = useState<Record<MapLayer, boolean>>({
    event: true,
    poi: true,
    member: true,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [satellite, setSatellite] = useState(false)
  const [showApplePois, setShowApplePois] = useState(false)
  const [addMode, setAddMode] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const [dayBarHeight, setDayBarHeight] = useState(48)

  const mapRef = useRef<AppleMaps.MapView>(null)
  const { targets } = useWayfinderTargets(tripId, visible.member)
  // GPS is only watched while a marker sheet is open (for the distance line), and on the 'coarse'
  // profile (5s/25m) since the readout is a static distance, not a live track - this keeps the
  // sub-second re-render cadence off the native map. The blue dot is independent via
  // isMyLocationEnabled, so the map still shows the user without any JS watcher churn.
  const user = useUserLocation(selectedId !== null, 'coarse')

  // Frame the map once on first load (imperatively); a controlled cameraPosition prop would snap
  // back to the overview on every targets refetch (member-location polling), fighting the user.
  const framedRef = useRef(false)
  useEffect(() => {
    if (framedRef.current || targets.length === 0) {
      return
    }
    const frame = cameraFor(targets)
    if (frame) {
      mapRef.current?.setCameraPosition(frame)
      framedRef.current = true
    }
  }, [targets])

  // Group dated events/gates into local calendar days, each sorted chronologically.
  const dayGroups = useMemo<DayGroup[]>(() => {
    const groups = new Map<string, DayGroup>()
    for (const target of targets) {
      if (!isEventKind(target.kind) || !target.startsAt) {
        continue
      }
      const key = dayKeyOf(target.startsAt)
      const existing = groups.get(key)
      if (existing) {
        existing.targets.push(target)
      } else {
        groups.set(key, { key, label: dayLabel(target.startsAt), targets: [target] })
      }
    }
    const ordered = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
    for (const group of ordered) {
      group.targets.sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''))
    }
    return ordered
  }, [targets])

  const shown = useMemo(
    () =>
      targets.filter((target) => {
        if (!visible[layerOf(target.kind)]) {
          return false
        }
        if (isEventKind(target.kind)) {
          if (selectedDay === null) {
            return true
          }
          return target.startsAt ? dayKeyOf(target.startsAt) === selectedDay : false
        }
        return true
      }),
    [targets, visible, selectedDay],
  )

  const markers = useMemo(
    () =>
      shown.map((target) => ({
        id: target.id,
        coordinates: { latitude: target.lat, longitude: target.lng },
        title: target.label,
        systemImage: mapSymbolFor(target.kind, target.icon),
        tintColor: mapTintFor(theme.colors, target.kind),
      })),
    [shown, theme],
  )

  // One coloured polyline per visible day, connecting that day's events in order.
  const polylines = useMemo(() => {
    if (!visible.event) {
      return []
    }
    return dayGroups.flatMap((group, index) => {
      if ((selectedDay !== null && selectedDay !== group.key) || group.targets.length < 2) {
        return []
      }
      return [
        {
          id: `route:${group.key}`,
          coordinates: group.targets.map((target) => ({
            latitude: target.lat,
            longitude: target.lng,
          })),
          color: dayColor(index),
          width: 4,
        },
      ]
    })
  }, [dayGroups, visible.event, selectedDay])

  const properties = useMemo(
    () => ({
      isMyLocationEnabled: true,
      mapType: satellite ? AppleMaps.MapType.IMAGERY : AppleMaps.MapType.STANDARD,
      // Hide Apple's own POIs by default for a clean trip map; the toggle reveals them.
      pointsOfInterest: showApplePois ? undefined : { including: [] },
    }),
    [satellite, showApplePois],
  )
  const colorScheme =
    rt.themeName === 'dark' ? AppleMaps.MapColorScheme.DARK : AppleMaps.MapColorScheme.LIGHT

  // Stable handler identities: AppleMaps.View is not memoised and re-attaches its native click
  // callbacks whenever these change, so keep them out of the per-render churn. Selecting a marker
  // also cancels any pending add-place gesture so the hint banner + active add button don't linger.
  const handleMarkerClick = useCallback((marker: AppleMaps.Marker) => {
    setLayersOpen(false)
    setAddMode(false)
    setSelectedId(marker.id ?? null)
  }, [])
  const handleMapClick = useCallback(
    (event: { coordinates: { latitude?: number; longitude?: number } }) => {
      const { latitude, longitude } = event.coordinates
      if (addMode && latitude != null && longitude != null) {
        setAddMode(false)
        router.push({
          pathname: '/trips/[id]/pois/new',
          params: { id: tripId, lat: String(latitude), lng: String(longitude) },
        })
      } else {
        setSelectedId(null)
      }
    },
    [addMode, tripId, router],
  )

  const selected = selectedId ? (targets.find((target) => target.id === selectedId) ?? null) : null
  const selectedDistance = selected && user.location ? haversine(user.location, selected) : null

  if (Platform.OS !== 'ios') {
    return (
      <Screen title={t('map.title')} showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('map.iosOnly')}</Text>
        </View>
      </Screen>
    )
  }

  // Only fall back to the empty screen when members are included in the count. If the member layer
  // is off and that alone empties the targets, keep the map mounted so the Layers control stays
  // reachable to turn members back on - otherwise a member-only trip would trap the user here.
  if (targets.length === 0 && visible.member) {
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

  function selectDay(key: string | null) {
    setSelectedDay(key)
    const frame =
      key === null
        ? cameraFor(targets)
        : cameraFor(dayGroups.find((group) => group.key === key)?.targets ?? [])
    if (frame) {
      mapRef.current?.setCameraPosition(frame)
    }
  }

  function refit() {
    const frame = cameraFor(shown.length > 0 ? shown : targets)
    if (frame) {
      mapRef.current?.setCameraPosition(frame)
    }
  }

  function openDirections(target: WayfinderTarget) {
    void Linking.openURL(`http://maps.apple.com/?daddr=${target.lat},${target.lng}`)
  }

  const clusterBottom =
    rt.insets.bottom + theme.gap(6) + (dayGroups.length > 0 ? dayBarHeight + theme.gap(3) : 0)

  return (
    <View style={styles.root}>
      <AppleMaps.View
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        markers={markers}
        polylines={polylines}
        properties={properties}
        uiSettings={MAP_UI_SETTINGS}
        colorScheme={colorScheme}
        onMarkerClick={handleMarkerClick}
        onMapClick={handleMapClick}
      />

      <View style={[styles.appBar, { top: rt.insets.top + theme.gap(2) }]} pointerEvents="box-none">
        <MapButton icon="chevron-back" label={t('common.back')} onPress={() => router.back()} />
        <MapButton
          icon="layers-outline"
          label={t('map.layers.title')}
          onPress={() => {
            setSelectedId(null)
            setLayersOpen(true)
          }}
        />
      </View>

      {addMode ? (
        <View style={[styles.hint, { top: rt.insets.top + theme.gap(14) }]} pointerEvents="none">
          <Surface
            radius={theme.radius.full}
            color={theme.colors.primary}
            borderWidth={0}
            style={styles.hintInner}
          >
            <Text style={styles.hintText}>{t('map.addHint')}</Text>
          </Surface>
        </View>
      ) : null}

      <View style={[styles.cluster, { bottom: clusterBottom }]} pointerEvents="box-none">
        <MapButton icon="scan-outline" label={t('map.recenter')} onPress={refit} />
        <MapButton
          icon="add-outline"
          label={t('map.addPlace')}
          active={addMode}
          onPress={() => setAddMode((prev) => !prev)}
        />
      </View>

      {dayGroups.length > 0 ? (
        <View
          style={[styles.dayBar, { bottom: rt.insets.bottom + theme.gap(6) }]}
          pointerEvents="box-none"
          onLayout={(event) => setDayBarHeight(event.nativeEvent.layout.height)}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}
          >
            <DayChip
              active={selectedDay === null}
              label={t('map.allDays')}
              onPress={() => selectDay(null)}
            />
            {dayGroups.map((group, index) => (
              <DayChip
                key={group.key}
                active={selectedDay === group.key}
                label={group.label}
                color={dayColor(index)}
                onPress={() => selectDay(group.key)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <BottomSheet
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        title={t('map.layers.title')}
      >
        <View style={styles.layersBody}>
          <View style={styles.layersSection}>
            <Text style={styles.sectionLabel}>{t('map.mapStyle')}</Text>
            <View style={styles.pillRow}>
              <DayChip
                active={!satellite}
                label={t('map.standard')}
                onPress={() => setSatellite(false)}
              />
              <DayChip
                active={satellite}
                label={t('map.satellite')}
                onPress={() => setSatellite(true)}
              />
              <DayChip
                active={showApplePois}
                label={t('map.applePois')}
                onPress={() => setShowApplePois((prev) => !prev)}
              />
            </View>
          </View>

          <View style={styles.layersSection}>
            <Text style={styles.sectionLabel}>{t('map.showOnMap')}</Text>
            <View style={styles.pillRow}>
              {LAYERS.map((layer) => (
                <Pressable
                  key={layer}
                  onPress={() => toggleLayer(layer)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: visible[layer] }}
                >
                  <Surface
                    radius={theme.radius.full}
                    color={theme.colors.card}
                    borderColor={theme.colors.border}
                    borderWidth={1}
                    style={[styles.layerChip, !visible[layer] && styles.layerChipOff]}
                  >
                    <View
                      style={[styles.dot, { backgroundColor: mapTintFor(theme.colors, layer) }]}
                    />
                    <Text style={styles.layerChipLabel}>{t(`map.layers.${layer}s`)}</Text>
                  </Surface>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.label}
      >
        {selected ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Badge label={t(`map.kind.${selected.kind}`)} tone={badgeTone(selected.kind)} />
              {selectedDistance !== null ? (
                <Text style={styles.sheetDistance}>
                  {`${formatDistance(selectedDistance)} · ${formatWalkingTime(selectedDistance)}`}
                </Text>
              ) : null}
            </View>
            <View style={styles.sheetActions}>
              <Button
                label={t('map.directions')}
                icon="navigate-outline"
                onPress={() => openDirections(selected)}
              />
              {isEventKind(selected.kind) ? (
                <Button
                  label={t('map.viewEvent')}
                  variant="secondary"
                  icon="calendar-outline"
                  onPress={() => {
                    setSelectedId(null)
                    router.push({
                      pathname: '/trips/[id]/events/[eventId]',
                      params: { id: tripId, eventId: selected.sourceId },
                    })
                  }}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </View>
  )
}

function MapButton({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
  active?: boolean
}) {
  const { theme } = useUnistyles()
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Surface
        radius={theme.radius.full}
        color={active ? theme.colors.primary : theme.colors.background}
        borderColor={active ? theme.colors.primary : theme.colors.border}
        borderWidth={1}
        style={styles.mapButton}
      >
        <Ionicons
          name={icon}
          size={20}
          color={active ? theme.colors.primaryForeground : theme.colors.foreground}
        />
      </Surface>
    </Pressable>
  )
}

function DayChip({
  active,
  label,
  color,
  onPress,
}: {
  active: boolean
  label: string
  color?: string
  onPress: () => void
}) {
  const { theme } = useUnistyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Surface
        radius={theme.radius.full}
        color={active ? theme.colors.primary : theme.colors.background}
        borderColor={active ? theme.colors.primary : theme.colors.border}
        borderWidth={1}
        style={styles.dayChip}
      >
        {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
        <Text style={[styles.dayChipLabel, active && styles.dayChipLabelActive]}>{label}</Text>
      </Surface>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
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
  appBar: {
    position: 'absolute',
    left: theme.gap(3),
    right: theme.gap(3),
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cluster: {
    position: 'absolute',
    right: theme.gap(3),
    gap: theme.gap(2),
  },
  mapButton: {
    width: theme.gap(11),
    height: theme.gap(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dayBar: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  dayRow: {
    paddingLeft: theme.gap(3),
    paddingRight: theme.gap(3) + CLUSTER_FOOTPRINT,
    gap: theme.gap(2),
  },
  dayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
  },
  dayChipLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  dayChipLabelActive: {
    color: theme.colors.primaryForeground,
  },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintInner: {
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(4),
  },
  hintText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryForeground,
  },
  layersBody: {
    gap: theme.gap(5),
  },
  layersSection: {
    gap: theme.gap(2),
  },
  sectionLabel: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  layerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
  },
  layerChipOff: {
    opacity: 0.45,
  },
  layerChipLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  sheet: {
    gap: theme.gap(4),
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2),
  },
  sheetDistance: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  sheetActions: {
    gap: theme.gap(2),
  },
}))
