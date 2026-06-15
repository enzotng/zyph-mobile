import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { poiIconName } from '@/components/poi-icon-picker'
import {
  ARRIVAL_RADIUS_M,
  ArArrow,
  ArOverlay,
  ArPath,
  useWayfinderTargets,
  type WayfinderTarget,
} from '@/features/wayfinder'
import { bearing, formatDistance, formatWalkingTime, haversine, relativeHeading } from '@/lib/geo'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'
import { useDeviceTilt, useHeading, useUserLocation } from '@/lib/sensors'

export default function ArScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()

  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const { targets, isLoading } = useWayfinderTargets(tripId, true)
  const heading = useHeading(true)
  const tilt = useDeviceTilt(true)
  const userLocation = useUserLocation(true)
  const { width, height } = useWindowDimensions()

  // Auto-request camera permission on mount if not yet granted/asked.
  useEffect(() => {
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      void requestCameraPermission()
    }
  }, [cameraPermission, requestCameraPermission])

  const [activeId, setActiveId] = useState<string | null>(null)
  const active = useMemo(
    () => targets.find((t) => t.id === activeId) ?? targets[0] ?? null,
    [targets, activeId],
  )

  const stats = useMemo(() => {
    if (!active || !userLocation.location) {
      return null
    }
    const distance = haversine(userLocation.location, active)
    const targetBearing = bearing(userLocation.location, active)
    const delta = relativeHeading(targetBearing, heading.heading)
    return { distance, targetBearing, delta }
  }, [active, userLocation.location, heading.heading])

  // Haptic wayfinding feedback so the user can keep their eyes on the camera: a light pulse the
  // moment they swing onto the target heading, and a success buzz when they arrive. Refs gate each
  // to a state transition (with hysteresis on the heading) so the buzz never chatters, and re-arm
  // when the active target changes.
  const alignedRef = useRef(false)
  const arrivedRef = useRef(false)
  const activeIdRef = useRef<string | null>(null)
  useEffect(() => {
    const id = active?.id ?? null
    if (id !== activeIdRef.current) {
      // New target: re-arm the feedback and skip this tick - stats still describes the old target.
      activeIdRef.current = id
      alignedRef.current = false
      arrivedRef.current = false
      return
    }
    if (!stats) {
      return
    }
    if (stats.distance <= ARRIVAL_RADIUS_M) {
      // One-shot success on arrival; re-arms only when the active target changes, so stepping in
      // and out of the radius never re-buzzes.
      if (!arrivedRef.current) {
        haptics.success()
        arrivedRef.current = true
      }
      return
    }
    // Not arrived: a one-shot light pulse the moment the heading swings onto the target, with a
    // deadband (arm < 5, re-arm only after > 12) so it does not chatter around the threshold.
    if (Math.abs(stats.delta) < 5 && !alignedRef.current) {
      haptics.light()
      alignedRef.current = true
    } else if (Math.abs(stats.delta) > 12) {
      alignedRef.current = false
    }
  }, [stats, active?.id])

  const cameraReady = cameraPermission?.granted ?? false

  if (!cameraPermission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  if (!cameraReady) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('ar.cameraNeeded')}</Text>
        <Button label={t('ar.grantAccess')} onPress={() => void requestCameraPermission()} />
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backCta}>
          <Text style={styles.link}>{t('ar.goBack')}</Text>
        </Pressable>
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  if (targets.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="compass-outline" size={48} color={theme.colors.muted} />
        <Text style={styles.message}>{t('ar.noTargets')}</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backCta}>
          <Text style={styles.link}>{t('ar.goBack')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <CameraView style={styles.camera} facing="back" />

      <ArOverlay
        width={width}
        height={height}
        user={userLocation.location}
        heading={heading.heading}
        pitch={tilt.pitch}
        targets={targets}
        activeId={active?.id ?? null}
      />

      {stats && stats.distance > ARRIVAL_RADIUS_M ? (
        <ArPath width={width} height={height} delta={stats.delta} pitch={tilt.pitch} />
      ) : null}

      {stats ? (
        <ArArrow
          width={width}
          height={height}
          delta={stats.delta}
          pitch={tilt.pitch}
          distance={stats.distance}
        />
      ) : null}

      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('ar.close')}
          hitSlop={12}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={26} color={theme.colors.primaryForeground} />
        </Pressable>
        <View style={styles.accuracyBadge}>
          <Ionicons
            name={heading.available ? 'compass' : 'compass-outline'}
            size={14}
            color={theme.colors.primaryForeground}
          />
          <Text style={styles.badgeText} numberOfLines={1}>
            {heading.available
              ? `±${Math.max(1, Math.round(heading.accuracy * 5))}°`
              : t('ar.noCompass')}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        {targets.map((target) => (
          <TargetChip
            key={target.id}
            target={target}
            active={active?.id === target.id}
            onPress={() => {
              haptics.selection()
              setActiveId(target.id)
            }}
          />
        ))}
      </ScrollView>

      {active ? (
        <View style={styles.hud}>
          <View style={styles.hudHead}>
            <Ionicons name={poiIconName(active.icon)} size={22} color={theme.colors.primary} />
            <Text style={styles.hudTitle} numberOfLines={1}>
              {active.label}
            </Text>
          </View>
          {stats ? (
            <View style={styles.hudRow}>
              <Text style={styles.hudValue}>{formatDistance(stats.distance)}</Text>
              <Text style={styles.hudSep}>·</Text>
              <Text style={styles.hudValue}>{formatWalkingTime(stats.distance)}</Text>
              <Text style={styles.hudSep}>·</Text>
              <Text style={styles.hudDelta}>
                {stats.distance <= ARRIVAL_RADIUS_M
                  ? t('ar.arrived')
                  : Math.abs(stats.delta) < 5
                    ? t('ar.rightAhead')
                    : `${stats.delta > 0 ? '→' : '←'} ${Math.abs(Math.round(stats.delta))}°`}
              </Text>
            </View>
          ) : (
            <Text style={styles.hudMuted}>{t('ar.lookingForGps')}</Text>
          )}
          {tilt.available ? <Text style={styles.hudHint}>{t('ar.calibrateHint')}</Text> : null}
        </View>
      ) : null}
    </View>
  )
}

function TargetChip({
  target,
  active,
  onPress,
}: {
  target: WayfinderTarget
  active: boolean
  onPress: () => void
}) {
  const { theme } = useUnistyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      <Ionicons
        name={poiIconName(target.icon)}
        size={14}
        color={active ? theme.colors.primaryForeground : 'rgba(255,255,255,0.82)'}
      />
      <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]} numberOfLines={1}>
        {target.label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.gap(6),
    gap: theme.gap(3),
    backgroundColor: theme.colors.background,
  },
  message: {
    textAlign: 'center',
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.sans.semibold,
  },
  link: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
  },
  backCta: {
    paddingVertical: theme.gap(2),
  },
  topBar: {
    position: 'absolute',
    top: rt.insets.top + theme.gap(2),
    left: theme.gap(4),
    right: theme.gap(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: theme.gap(10),
    height: theme.gap(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.gap(5),
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  accuracyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(1),
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  badgeText: {
    color: theme.colors.primaryForeground,
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
  },
  chipsScroll: {
    position: 'absolute',
    top: rt.insets.top + theme.gap(14),
    left: 0,
    right: 0,
  },
  chipsRow: {
    paddingHorizontal: theme.gap(4),
    gap: theme.gap(2),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(2),
    borderRadius: theme.gap(5),
    // Inactive: dark glass that recedes against the camera (matches the POI cards).
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipActive: {
    // Active: solid indigo with an indigo halo so it clearly dominates (no white rim).
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 8,
    elevation: 6,
  },
  chipLabel: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    // Inactive label on the dark-glass chip: light but slightly muted so it recedes.
    color: 'rgba(255,255,255,0.82)',
    maxWidth: theme.gap(40),
  },
  chipLabelActive: {
    color: theme.colors.primaryForeground,
  },
  hud: {
    position: 'absolute',
    left: theme.gap(4),
    right: theme.gap(4),
    bottom: rt.insets.bottom + theme.gap(4),
    gap: theme.gap(2),
    paddingHorizontal: theme.gap(4),
    paddingVertical: theme.gap(4),
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  hudHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  hudTitle: {
    flex: 1,
    fontSize: theme.fontSize.lg,
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    color: theme.colors.primaryForeground,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  hudValue: {
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: theme.colors.primaryForeground,
  },
  hudSep: {
    color: 'rgba(255,255,255,0.5)',
  },
  hudDelta: {
    marginLeft: 'auto',
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  hudMuted: {
    color: 'rgba(255,255,255,0.7)',
  },
  hudHint: {
    fontSize: theme.fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
  },
}))
