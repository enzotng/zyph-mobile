import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { TRIP_TAB_BAR_CLEARANCE } from '@/components/layout/trip-tab-bar'
import { poiIconName } from '@/components/poi-icon-picker'
import { Screen } from '@/components/screen'
import {
  Avatar,
  Badge,
  EmptyState,
  ListRow,
  SectionTitle,
  Skeleton,
  Surface,
} from '@/components/ui'
import { type PlaceResult, usePlaceSearch } from '@/features/places'
import { useTrip } from '@/features/trips'
import {
  type MemberLocationWithMember,
  TripMapCanvas,
  type TripMapCanvasHandle,
  type TripPoi,
  useDeletePoi,
  useMemberLocations,
  usePois,
} from '@/features/wayfinder'
import { withAlpha } from '@/lib/color'
import { formatDistance, formatWalkingTime, haversine } from '@/lib/geo'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'
import { useUserLocation } from '@/lib/sensors'

const SKELETON_ROWS = [0, 1, 2, 3]
type NearbyTab = 'places' | 'people'

export default function PoisScreen() {
  if (Platform.OS === 'ios') {
    return <MapTab />
  }
  return <PoiListTab />
}

// ----- iOS: place-first map with a peek/expand Nearby sheet -----

function MapTab() {
  const params = useGlobalSearchParams<{ id: string; focus?: string }>()
  const tripId = paramString(params.id)
  // Optional target id (e.g. from the POI detail "Open in map") to centre + open on arrival.
  const focusId = paramString(params.focus) || null
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { theme, rt } = useUnistyles()

  const canvasRef = useRef<TripMapCanvasHandle>(null)
  const [tab, setTab] = useState<NearbyTab>('places')
  // The Nearby sheet is persistent (no scrim, so the map stays interactive); tapping the handle
  // toggles between a peek and an expanded height.
  const [expanded, setExpanded] = useState(false)

  const { data: pois } = usePois(tripId)
  const { data: members } = useMemberLocations(tripId, true)
  // A single coarse watcher feeds every distance readout in the list.
  const user = useUserLocation(true, 'coarse')
  const userLoc = user.location

  // Arriving with a focus param (e.g. from POI detail "Open in map"): centre + open it once the
  // canvas targets are ready. Guard on the POIs being loaded so the target exists on the canvas.
  const focusedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!focusId || !pois || focusedRef.current === focusId) {
      return
    }
    focusedRef.current = focusId
    canvasRef.current?.focusTarget(focusId)
  }, [focusId, pois])

  const liveCount = members?.length ?? 0

  const peekHeight = rt.screen.height * 0.4
  const expandedHeight = rt.screen.height * 0.72
  const sheetProgress = useSharedValue(0)
  const sheetStyle = useAnimatedStyle(() => ({
    height: peekHeight + (expandedHeight - peekHeight) * sheetProgress.value,
  }))

  function toggleSheet() {
    haptics.selection()
    setExpanded((prev) => {
      const next = !prev
      sheetProgress.value = withTiming(next ? 1 : 0, { duration: 240 })
      return next
    })
  }

  function goAddPoi() {
    haptics.light()
    // Enter add-place mode and collapse the sheet so the map is tappable; the next map tap opens
    // the new-POI form at that point.
    canvasRef.current?.startAddPlace()
    setExpanded(false)
    sheetProgress.value = withTiming(0, { duration: 240 })
  }

  function routeToPoi(poi: TripPoi) {
    haptics.selection()
    canvasRef.current?.focusTarget(`poi:${poi.id}`)
  }

  function openPoi(poi: TripPoi) {
    haptics.selection()
    router.push({
      pathname: '/trips/[id]/pois/[poiId]',
      params: { id: tripId, poiId: poi.id },
    })
  }

  function focusMember(member: MemberLocationWithMember) {
    const memberId = member.trip_member?.id ?? member.trip_member_id
    haptics.selection()
    canvasRef.current?.focusTarget(`member:${memberId}`)
  }

  const places = pois ?? []
  const people = useMemo(() => members ?? [], [members])

  // Search: a debounced place lookup (>= 3 chars) plus live filtering of trip members by name.
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(id)
  }, [searchQuery])
  const placeSearch = usePlaceSearch(debouncedQuery, i18n.language === 'fr' ? 'fr' : 'en')
  const trimmedQuery = searchQuery.trim()
  const searching = trimmedQuery.length > 0
  const placeResults = placeSearch.data ?? []
  const peopleMatches = useMemo(() => {
    if (!searching) {
      return []
    }
    const q = trimmedQuery.toLowerCase()
    return people.filter((m) =>
      (m.trip_member?.profile?.display_name ?? '').toLowerCase().includes(q),
    )
  }, [people, searching, trimmedQuery])

  function clearSearch() {
    setSearchQuery('')
    setDebouncedQuery('')
  }
  function selectPlace(place: PlaceResult) {
    haptics.selection()
    clearSearch()
    router.push({
      pathname: '/trips/[id]/pois/new',
      params: { id: tripId, lat: String(place.lat), lng: String(place.lng), name: place.label },
    })
  }
  function selectPerson(member: MemberLocationWithMember) {
    clearSearch()
    focusMember(member)
  }

  return (
    <View style={styles.root}>
      <TripMapCanvas ref={canvasRef} tripId={tripId} showAppBar={false} topInset={rt.insets.top} />

      {/* Top row: a card back tile + a search bar (visual entry point, phase 4A). */}
      <View style={[styles.topRow, { top: rt.insets.top + theme.gap(2) }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.navigate({ pathname: '/trips/[id]', params: { id: tripId } })}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Surface
            radius={theme.radius.md}
            color={theme.colors.card}
            borderColor={theme.colors.border}
            borderWidth={1}
            style={styles.backTile}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.foreground} />
          </Surface>
        </Pressable>

        <Surface
          radius={theme.radius.md}
          color={theme.colors.card}
          borderColor={theme.colors.border}
          borderWidth={1}
          style={styles.searchBar}
        >
          <Ionicons name="search" size={18} color={theme.colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('map.searchPlaceholder')}
            placeholderTextColor={theme.colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching ? (
            <Pressable
              onPress={clearSearch}
              accessibilityRole="button"
              accessibilityLabel={t('common.clear')}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
            </Pressable>
          ) : null}
        </Surface>
      </View>

      {searching ? (
        <View style={[styles.searchResults, { top: rt.insets.top + theme.gap(15) }]}>
          <Surface
            radius={theme.radius.lg}
            color={theme.colors.card}
            borderColor={theme.colors.border}
            borderWidth={1}
            style={styles.searchCard}
          >
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.searchScroll}>
              {peopleMatches.map((member) => {
                const name = member.trip_member?.profile?.display_name ?? t('common.member')
                return (
                  <Pressable
                    key={member.trip_member?.id ?? member.trip_member_id}
                    onPress={() => selectPerson(member)}
                    accessibilityRole="button"
                    accessibilityLabel={name}
                    style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                  >
                    <Ionicons name="person" size={18} color={theme.colors.primary} />
                    <Text style={styles.resultLabel} numberOfLines={1}>
                      {name}
                    </Text>
                  </Pressable>
                )
              })}
              {placeResults.map((place) => (
                <Pressable
                  key={`${place.lat},${place.lng}`}
                  onPress={() => selectPlace(place)}
                  accessibilityRole="button"
                  accessibilityLabel={place.label}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                >
                  <Ionicons name="location-outline" size={18} color={theme.colors.muted} />
                  <Text style={styles.resultLabel} numberOfLines={1}>
                    {place.label}
                  </Text>
                </Pressable>
              ))}
              {peopleMatches.length === 0 && placeResults.length === 0 ? (
                <Text style={styles.resultEmpty}>
                  {placeSearch.isFetching ? t('common.loading') : t('map.searchNoResults')}
                </Text>
              ) : null}
            </ScrollView>
          </Surface>
        </View>
      ) : null}

      {/* Accent recenter FAB, top-right under the search row. Hidden while searching so it never sits
          under the results dropdown (which spans the same vertical band) - recenter is irrelevant
          while picking a search result, and the map is covered anyway. */}
      {searching ? null : (
        <View
          style={[styles.recenterWrap, { top: rt.insets.top + theme.gap(14) }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => canvasRef.current?.recenter()}
            accessibilityRole="button"
            accessibilityLabel={t('map.recenter')}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Surface
              radius={theme.radius.full}
              color={theme.colors.primary}
              borderWidth={0}
              style={styles.recenterFab}
            >
              <Ionicons name="navigate" size={20} color={theme.colors.primaryForeground} />
            </Surface>
          </Pressable>
        </View>
      )}

      {/* Persistent Nearby sheet (peek / expanded). No scrim, so the map stays interactive. */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <Surface
          corners="top"
          color={theme.colors.background}
          borderWidth={0}
          radius={theme.radius.xl}
          style={styles.sheetSurface}
        >
          <Pressable
            onPress={toggleSheet}
            accessibilityRole="button"
            accessibilityLabel={t('map.nearbyTitle')}
            accessibilityState={{ expanded }}
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

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {tab === 'places' ? (
              <PlacesList
                places={places}
                userLoc={userLoc}
                onRoute={routeToPoi}
                onOpen={openPoi}
                onAdd={goAddPoi}
              />
            ) : (
              <PeopleList people={people} userLoc={userLoc} onFocus={focusMember} />
            )}
          </ScrollView>
        </Surface>
      </Animated.View>
    </View>
  )
}

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

// ----- Android: restyled POI list (no AppleMaps) -----

function PoiListTab() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { data: trip } = useTrip(tripId)
  const { data: pois, isLoading, isError, refetch } = usePois(tripId)
  const deletePoi = useDeletePoi(tripId)

  function confirmDelete(poiId: string, label: string) {
    Alert.alert(t('pois.deleteTitle'), t('pois.deleteBody', { label }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePoi.mutateAsync(poiId)
          } catch (error) {
            Alert.alert(
              t('pois.deleteError'),
              error instanceof Error ? error.message : t('common.tryAgain'),
            )
          }
        },
      },
    ])
  }

  function goAddPoi() {
    haptics.light()
    router.push({ pathname: '/trips/[id]/pois/new', params: { id: tripId } })
  }

  const addButton = (
    <Pressable
      onPress={goAddPoi}
      accessibilityRole="button"
      accessibilityLabel={t('pois.addWaypoint')}
      hitSlop={8}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Ionicons name="add" size={26} color={theme.colors.foreground} />
    </Pressable>
  )

  const arHero = (
    <Pressable
      onPress={() => router.push({ pathname: '/trips/[id]/ar', params: { id: tripId } })}
      accessibilityRole="button"
      accessibilityLabel={t('pois.openAr')}
    >
      <Surface
        color={theme.colors.primary}
        borderWidth={0}
        radius={theme.radius.lg}
        style={styles.arHero}
      >
        <View style={styles.arIconTile}>
          <Ionicons name="navigate" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.arInfo}>
          <Text style={styles.arTitle}>{t('pois.arTitle')}</Text>
          <Text style={styles.arSubtitle}>{t('pois.arSubtitle')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </Surface>
    </Pressable>
  )

  if (isLoading) {
    return (
      <Screen title={trip?.title} showBack scroll right={addButton}>
        {arHero}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.skeletonList}
          accessibilityRole="progressbar"
          accessibilityLabel={t('pois.sectionTitle')}
        >
          <Skeleton width="40%" height={18} radius={theme.radius.sm} />
          {SKELETON_ROWS.map((row) => (
            <View key={row} style={styles.skeletonRow}>
              <Skeleton width={38} height={38} radius={theme.radius.md} />
              <View style={styles.skeletonText}>
                <Skeleton width="55%" height={15} radius={theme.radius.sm} />
                <Skeleton width="32%" height={12} radius={theme.radius.sm} />
              </View>
            </View>
          ))}
        </Animated.View>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen title={trip?.title} showBack scroll right={addButton}>
        {arHero}
        <View style={styles.center}>
          <Text style={styles.muted}>{t('pois.loadError')}</Text>
          <Button
            label={t('common.retry')}
            variant="secondary"
            icon="refresh"
            block={false}
            onPress={() => void refetch()}
          />
        </View>
      </Screen>
    )
  }

  const waypoints = pois ?? []

  return (
    <Screen title={trip?.title} showBack scroll right={addButton}>
      {arHero}

      <SectionTitle action={t('common.add')} onAction={goAddPoi}>
        {t('pois.sectionTitle')}
      </SectionTitle>

      {waypoints.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="location-outline"
            title={t('pois.emptyTitle')}
            body={t('pois.emptyBody')}
            cta={t('pois.addWaypoint')}
            onCta={goAddPoi}
          />
        </View>
      ) : (
        <Animated.View style={styles.list} entering={FadeIn.duration(300)}>
          {waypoints.map((item, index) => (
            <Animated.View
              key={item.id}
              entering={FadeInDown.duration(280).delay(Math.min(index, 7) * 40)}
              layout={LinearTransition}
            >
              <ListRow
                icon={poiIconName(item.icon)}
                iconColor={theme.colors.accent}
                title={item.label}
                subtitle={t('pois.subtitle')}
                last={index === waypoints.length - 1}
                accessibilityLabel={item.label}
                onPress={() =>
                  router.push({
                    pathname: '/trips/[id]/pois/[poiId]',
                    params: { id: tripId, poiId: item.id },
                  })
                }
                right={
                  <Pressable
                    onPress={() => confirmDelete(item.id, item.label)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('common.delete')} ${item.label}`}
                    hitSlop={8}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.destructive} />
                  </Pressable>
                }
              />
            </Animated.View>
          ))}
        </Animated.View>
      )}

      <View style={styles.spacer} />
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  topRow: {
    position: 'absolute',
    left: theme.gap(3),
    right: theme.gap(3),
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  backTile: {
    width: theme.gap(11),
    height: theme.gap(11),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    height: theme.gap(11),
    paddingHorizontal: theme.gap(4),
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
    paddingVertical: 0,
  },
  searchResults: {
    position: 'absolute',
    left: theme.gap(3),
    right: theme.gap(3),
    zIndex: 10,
  },
  searchCard: {
    maxHeight: 260,
    paddingVertical: theme.gap(1),
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  searchScroll: {
    flexGrow: 0,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2.5),
    paddingHorizontal: theme.gap(4),
  },
  resultLabel: {
    flex: 1,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  resultEmpty: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingVertical: theme.gap(4),
    paddingHorizontal: theme.gap(4),
  },
  recenterWrap: {
    position: 'absolute',
    right: theme.gap(3),
  },
  recenterFab: {
    width: theme.gap(12),
    height: theme.gap(12),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
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
  // Android list styles.
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(8),
  },
  skeletonList: {
    marginTop: theme.gap(4),
    gap: theme.gap(3),
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  skeletonText: {
    flex: 1,
    gap: theme.gap(1),
  },
  arHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    padding: theme.gap(4),
  },
  arIconTile: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  arInfo: {
    flex: 1,
    minWidth: 0,
    gap: theme.gap(0.5),
  },
  arTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
    color: '#FFFFFF',
  },
  arSubtitle: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.82)',
  },
  list: {
    marginTop: theme.gap(1),
  },
  emptyWrap: {
    marginTop: theme.gap(4),
  },
  muted: {
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
  },
  spacer: {
    height: TRIP_TAB_BAR_CLEARANCE,
  },
}))
