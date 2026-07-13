import { Ionicons } from '@expo/vector-icons'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { poiIconName } from '@/components/poi-icon-picker'
import { Avatar, Badge, Skeleton, Surface } from '@/components/ui'
import { withAlpha } from '@/lib/color'
import { formatDistance, formatWalkingTime, haversine } from '@/lib/geo'
import { haptics } from '@/lib/haptics'

import type { MemberLocationWithMember, TripPoi } from '../api/wayfinder.api'
import { nextSnap, resolveSnap, type SnapPoint, snapHeights } from './nearby-snap'

const SKELETON_ROWS = [0, 1, 2, 3]
const SPRING = { damping: 22, stiffness: 220, mass: 0.6 } as const

type NearbyTab = 'places' | 'people'

export type NearbySheetProps = {
  places: TripPoi[]
  people: MemberLocationWithMember[]
  userLoc: { lat: number; lng: number } | null
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onRoutePlace: (poi: TripPoi) => void
  onOpenPlace: (poi: TripPoi) => void
  onFocusPerson: (member: MemberLocationWithMember) => void
  onAddPlace: () => void
  // Controlled, so the map can force the sheet down while arming add-place mode. The parent
  // MUST echo every `onSnapChange` call back into this prop - the sheet's internal refs are
  // reconciled against the prop, not against the callback, so a parent that ignores the echo
  // lets those refs drift out of sync with what is actually rendered.
  snap: SnapPoint
  onSnapChange: (snap: SnapPoint) => void
}

// The draggable Nearby sheet: docked / mid / expanded snap heights, dragged from the header
// only (grabber + title + segmented). The inner list keeps its own untouched scroll gestures.
export function NearbySheet({
  places,
  people,
  userLoc,
  isLoading,
  isError,
  onRetry,
  onRoutePlace,
  onOpenPlace,
  onFocusPerson,
  onAddPlace,
  snap,
  onSnapChange,
}: NearbySheetProps) {
  const { t } = useTranslation()
  const { theme, rt } = useUnistyles()
  // Places/People segment is local UI state; only the snap is controlled from outside.
  const [tab, setTab] = useState<NearbyTab>('places')

  const heights = useMemo(() => snapHeights(rt.screen.height), [rt.screen.height])

  const height = useSharedValue(heights[snap])
  // The height the sheet had when the current drag began.
  const startHeight = useSharedValue(heights[snap])
  // Mirrors the snap the sheet has actually animated to, so an echo of our own onSnapChange
  // (parent -> prop) does not re-fire the animation.
  const appliedSnap = useRef<SnapPoint>(snap)
  const snapRef = useRef<SnapPoint>(snap)
  // UI-thread flag: true for the whole lifetime of a finger-down gesture (onStart..onFinalize).
  const dragging = useSharedValue(false)
  // A snap forced by the parent WHILE the finger is down: honoured on release instead of fighting
  // the gesture frame by frame.
  const pendingSnap = useRef<SnapPoint | null>(null)

  useEffect(() => {
    // Keep the "latest snap" ref current for the worklet-adjacent callbacks below (settle,
    // cycleSnap): they read it outside React's render cycle, so this effect - not a
    // render-time assignment - is what the React Compiler expects for a ref mutation.
    snapRef.current = snap
    if (appliedSnap.current === snap) {
      return
    }
    if (dragging.value) {
      // The finger is down: writing height.value here would race the gesture's per-frame
      // writes on the UI thread and lose every time. Defer to settle() on release instead.
      pendingSnap.current = snap
      return
    }
    appliedSnap.current = snap
    height.value = withSpring(heights[snap], SPRING)
  }, [snap, heights, height, dragging])

  // Runs on the JS thread once the finger lifts.
  const settle = useCallback(
    (released: number, velocityY: number) => {
      const forced = pendingSnap.current
      pendingSnap.current = null
      const previous = snapRef.current
      const landing = forced ?? resolveSnap(released, velocityY, heights, previous)
      appliedSnap.current = landing
      snapRef.current = landing
      // eslint-disable-next-line react-hooks/immutability
      height.value = withSpring(heights[landing], SPRING)
      // A forced snap came FROM the parent, so echoing it back would be a pointless round-trip.
      if (!forced && landing !== previous) {
        haptics.selection()
        onSnapChange(landing)
      }
    },
    [heights, height, onSnapChange],
  )

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          // Runs on the UI thread inside a Reanimated worklet, not during React render.
          // eslint-disable-next-line react-hooks/immutability
          dragging.value = true
          // eslint-disable-next-line react-hooks/immutability
          startHeight.value = height.value
        })
        .onChange((event) => {
          // Dragging up (negative translationY) grows the sheet.
          const next = startHeight.value - event.translationY
          // eslint-disable-next-line react-hooks/immutability
          height.value = Math.min(Math.max(next, heights.docked), heights.expanded)
        })
        // The flagged expression is `settle`, a plain JS-thread useCallback that closes over
        // refs (snapRef, appliedSnap, pendingSnap) and mutates them - it is only ever invoked
        // here via runOnJS, once the gesture ends, never during a React render pass.
        // eslint-disable-next-line react-hooks/refs
        .onEnd((event) => {
          runOnJS(settle)(height.value, event.velocityY)
        })
        .onFinalize(() => {
          // Fires on the UI thread after onEnd, so the JS settle() scheduled by runOnJS above
          // never observes a stale flag.
          // eslint-disable-next-line react-hooks/immutability
          dragging.value = false
        }),
    [heights, height, startHeight, settle, dragging],
  )

  const sheetStyle = useAnimatedStyle(() => ({ height: height.value }))

  const liveCount = people.length

  function cycleSnap() {
    const next = nextSnap(snapRef.current)
    snapRef.current = next
    haptics.selection()
    onSnapChange(next)
  }

  return (
    <Animated.View style={[styles.sheet, sheetStyle]}>
      <Surface
        corners="top"
        color={theme.colors.background}
        borderWidth={0}
        radius={theme.radius.xl}
        style={styles.sheetSurface}
      >
        <GestureDetector gesture={pan}>
          <View>
            <Pressable
              onPress={cycleSnap}
              accessibilityRole="button"
              accessibilityLabel={t('map.nearbyTitle')}
              accessibilityState={{ expanded: snap === 'expanded' }}
            >
              <View style={styles.grabber} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{t('map.nearbyTitle')}</Text>
                {liveCount > 0 ? (
                  <Badge
                    label={t('map.sharingLive', { count: liveCount })}
                    tone="success"
                    icon="radio"
                  />
                ) : null}
              </View>
            </Pressable>
            <View style={styles.segmentedWrap}>
              <NearbySegmented active={tab} onChange={setTab} />
            </View>
          </View>
        </GestureDetector>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isError ? (
            <View style={styles.nearbyEmpty}>
              <Text style={styles.nearbyEmptyText}>{t('pois.loadError')}</Text>
              <Button
                label={t('common.retry')}
                variant="secondary"
                icon="refresh"
                block={false}
                onPress={onRetry}
              />
            </View>
          ) : isLoading ? (
            <View style={styles.nearbyList} accessible accessibilityRole="progressbar">
              {SKELETON_ROWS.map((row) => (
                <View key={row} style={styles.nearbyRow}>
                  <Skeleton width={42} height={42} radius={theme.radius.md} />
                  <View style={styles.skeletonText}>
                    <Skeleton width="55%" height={15} radius={theme.radius.sm} />
                    <Skeleton width="32%" height={12} radius={theme.radius.sm} />
                  </View>
                </View>
              ))}
            </View>
          ) : tab === 'places' ? (
            <PlacesList
              places={places}
              userLoc={userLoc}
              onRoute={onRoutePlace}
              onOpen={onOpenPlace}
              onAdd={onAddPlace}
            />
          ) : (
            <PeopleList people={people} userLoc={userLoc} onFocus={onFocusPerson} />
          )}
        </ScrollView>
      </Surface>
    </Animated.View>
  )
}

// ----- Moved verbatim from (tabs)/pois.tsx (Task 7 deletes that file) -----

function NearbySegmented({
  active,
  onChange,
}: {
  active: NearbyTab
  onChange: (tab: NearbyTab) => void
}) {
  const { t } = useTranslation()
  return (
    <View style={styles.track}>
      <NearbySegment
        label={t('map.tabPlaces')}
        active={active === 'places'}
        onPress={() => onChange('places')}
      />
      <NearbySegment
        label={t('map.tabPeople')}
        active={active === 'people'}
        onPress={() => onChange('people')}
      />
    </View>
  )
}

function NearbySegment({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const handlePress = () => {
    if (!active) {
      haptics.selection()
      onPress()
    }
  }
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.segment,
        active && styles.segmentActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

function PlacesList({
  places,
  userLoc,
  onRoute,
  onOpen,
  onAdd,
}: {
  places: TripPoi[]
  userLoc: { lat: number; lng: number } | null
  onRoute: (poi: TripPoi) => void
  onOpen: (poi: TripPoi) => void
  onAdd: () => void
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  if (places.length === 0) {
    return (
      <View style={styles.nearbyEmpty}>
        <Text style={styles.nearbyEmptyText}>{t('map.noPlaces')}</Text>
        <Button label={t('pois.addWaypoint')} icon="add" block={false} onPress={onAdd} />
      </View>
    )
  }

  return (
    <View style={styles.nearbyList}>
      {places.map((poi) => {
        const distance = userLoc ? haversine(userLoc, { lat: poi.lat, lng: poi.lng }) : null
        const subtitle =
          distance !== null
            ? t('map.distanceWalk', {
                distance: formatDistance(distance),
                walk: formatWalkingTime(distance),
              })
            : t('pois.subtitle')
        return (
          // No per-row `entering`: the Nearby list remounts on every Places/People tab switch and
          // sheet toggle, which would replay a mount animation each time. `layout` only.
          <Animated.View key={poi.id} layout={LinearTransition}>
            <NearbyRow
              iconTile={
                <View
                  style={[
                    styles.iconTile,
                    { backgroundColor: withAlpha(theme.colors.accent, 0.14) },
                  ]}
                >
                  <Ionicons name={poiIconName(poi.icon)} size={20} color={theme.colors.accent} />
                </View>
              }
              title={poi.label}
              subtitle={subtitle}
              onPress={() => onOpen(poi)}
              right={
                <Button
                  label={t('map.route')}
                  icon="navigate-outline"
                  size="sm"
                  block={false}
                  onPress={() => onRoute(poi)}
                />
              }
            />
          </Animated.View>
        )
      })}
    </View>
  )
}

function PeopleList({
  people,
  userLoc,
  onFocus,
}: {
  people: MemberLocationWithMember[]
  userLoc: { lat: number; lng: number } | null
  onFocus: (member: MemberLocationWithMember) => void
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  if (people.length === 0) {
    return (
      <View style={styles.nearbyEmpty}>
        <Text style={styles.nearbyEmptyText}>{t('map.noPeople')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.nearbyList}>
      {people.map((member) => {
        const name = member.trip_member?.profile?.display_name ?? t('common.member')
        const distance = userLoc ? haversine(userLoc, { lat: member.lat, lng: member.lng }) : null
        const subtitle =
          distance !== null
            ? t('map.distanceWalk', {
                distance: formatDistance(distance),
                walk: formatWalkingTime(distance),
              })
            : t('map.locating')
        return (
          // No per-row `entering` (see PlacesList): the list remounts on tab switch + sheet toggle.
          <Animated.View
            key={member.trip_member?.id ?? member.trip_member_id}
            layout={LinearTransition}
          >
            <NearbyRow
              iconTile={
                <Avatar
                  name={name}
                  imageUrl={member.trip_member?.profile?.avatar_url}
                  size={42}
                  tint={theme.colors.success}
                />
              }
              title={name}
              subtitle={subtitle}
              onPress={() => onFocus(member)}
              right={<Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />}
            />
          </Animated.View>
        )
      })}
    </View>
  )
}

function NearbyRow({
  iconTile,
  title,
  subtitle,
  right,
  onPress,
}: {
  iconTile: ReactNode
  title: string
  subtitle: string
  right?: ReactNode
  onPress?: () => void
}) {
  const content = (
    <View style={styles.nearbyRow}>
      {iconTile}
      <View style={styles.nearbyRowText}>
        <Text style={styles.nearbyRowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.nearbyRowSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {right}
    </View>
  )
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {content}
      </Pressable>
    )
  }
  return content
}

const styles = StyleSheet.create((theme, rt) => ({
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  // Anchored to the very bottom of the screen - there is no tab bar on this screen.
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetSurface: {
    flex: 1,
    paddingTop: theme.gap(2),
    paddingHorizontal: theme.gap(5),
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.gap(3),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  sheetTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
  },
  segmentedWrap: {
    marginTop: theme.gap(3),
  },
  sheetScroll: {
    marginTop: theme.gap(3),
  },
  sheetScrollContent: {
    paddingBottom: rt.insets.bottom + theme.gap(4),
    gap: theme.gap(1),
  },
  // Nearby segmented (mirrors PlanSegmented, scoped here to avoid coupling).
  track: {
    flexDirection: 'row',
    gap: theme.gap(1.5),
    padding: theme.gap(1),
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: withAlpha(theme.colors.foreground, 0.06),
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.gap(2.25),
    borderRadius: 11,
    borderCurve: 'continuous',
  },
  segmentActive: {
    backgroundColor: theme.colors.card,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentLabel: {
    fontFamily: theme.fonts.display.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  segmentLabelActive: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  nearbyList: {
    gap: theme.gap(1),
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2),
  },
  iconTile: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  nearbyRowText: {
    flex: 1,
    minWidth: 0,
    gap: theme.gap(0.5),
  },
  nearbyRowTitle: {
    fontFamily: theme.fonts.display.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  nearbyRowSubtitle: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  nearbyEmpty: {
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(6),
  },
  nearbyEmptyText: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  skeletonText: {
    flex: 1,
    gap: theme.gap(1),
  },
}))
