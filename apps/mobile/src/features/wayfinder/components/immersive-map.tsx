import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Surface } from '@/components/ui'
import { type PlaceResult, usePlaceSearch } from '@/features/places'
import { haptics } from '@/lib/haptics'
import { useUserLocation } from '@/lib/sensors'

import type { MemberLocationWithMember, TripPoi } from '../api/wayfinder.api'
import { useMemberLocations, usePois } from '../hooks/use-wayfinder'
import { MapButton } from './map-button'
import { NearbySheet } from './nearby-sheet'
import type { SnapPoint } from './nearby-snap'
import { TripMapCanvas, type TripMapCanvasHandle } from './trip-map-canvas'

type ImmersiveMapProps = {
  tripId: string
  // Optional target id (e.g. from the POI detail "Open in map") to centre + open on arrival.
  focusId: string | null
}

// The place-first immersive Map: a full-bleed AppleMaps canvas, a floating search row, a
// right-hand control stack (recenter / layers / AR) and a draggable Nearby sheet docked at the
// bottom. Lifted from the old `(tabs)/pois.tsx` MapTab (a later task deletes that file), now
// driven by the extracted TripMapCanvas + NearbySheet components instead of owning that state
// inline.
export function ImmersiveMap({ tripId, focusId }: ImmersiveMapProps) {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { theme, rt } = useUnistyles()

  const canvasRef = useRef<TripMapCanvasHandle>(null)
  // The Nearby sheet starts docked (a 96pt bar) so the map owns ~90% of the screen at rest.
  const [snap, setSnap] = useState<SnapPoint>('docked')
  const [addMode, setAddMode] = useState(false)

  const { data: pois, isLoading, isError, refetch } = usePois(tripId)
  const { data: members } = useMemberLocations(tripId, true)
  // A single coarse watcher feeds every distance readout in the sheet. Deliberately NOT gated on the
  // sheet being open: useUserLocation resets to a null location whenever it is disabled, so gating it
  // would wipe every distance on each dock/re-open (they would fall back to "Point of interest" until
  // a fresh fix lands, up to 5s later). The saving would be phantom anyway - the canvas keeps
  // isMyLocationEnabled on, so the OS is already tracking the user for the map's blue dot.
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

  // The control stack has no business being reachable while the search results dropdown covers
  // the same vertical band, or while the map is armed and waiting for a placement tap (the hint
  // pill + Cancel control on the canvas are the only affordances that should stay reachable then).
  const showControls = !searching && !addMode

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

  // The map is pushed now, so the back tile pops it and lands on whichever tab opened it - matching
  // the iOS swipe-back. It only falls back to the trip home when there is nothing to pop, i.e. a deep
  // link straight to the map, where popping would leave the trip entirely.
  function goBack() {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace({ pathname: '/trips/[id]', params: { id: tripId } })
  }

  function goAddPoi() {
    haptics.light()
    // Enter add-place mode and dock the sheet so the map is tappable; the next map tap opens
    // the new-POI form at that point.
    canvasRef.current?.startAddPlace()
    setSnap('docked')
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

  return (
    <View style={styles.root}>
      <TripMapCanvas
        ref={canvasRef}
        tripId={tripId}
        topInset={rt.insets.top}
        onAddModeChange={setAddMode}
      />

      {/* Top row: a card back tile + a search bar. */}
      <View style={[styles.topRow, { top: rt.insets.top + theme.gap(2) }]} pointerEvents="box-none">
        <Pressable
          onPress={goBack}
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

      {/* Control stack: recenter, layers, AR - under the search row, hidden while searching so it
          never sits under the results dropdown (which spans the same vertical band), and hidden
          while add-place mode is armed so it isn't reachable while the map is waiting for a
          placement tap (e.g. opening the layers sheet over a still-armed map). */}
      {showControls ? (
        <View
          style={[styles.controlStack, { top: rt.insets.top + theme.gap(14) }]}
          pointerEvents="box-none"
        >
          <MapButton
            icon="navigate"
            label={t('map.recenter')}
            tone="primary"
            onPress={() => canvasRef.current?.recenter()}
          />
          <MapButton
            icon="layers-outline"
            label={t('map.layers.title')}
            onPress={() => canvasRef.current?.openLayers()}
          />
          <MapButton
            icon="scan-outline"
            label={t('pois.openAr')}
            onPress={() => router.push({ pathname: '/trips/[id]/ar', params: { id: tripId } })}
          />
        </View>
      ) : null}

      {/* Cancel control for add-place mode, anchored under the canvas's own hint pill (which sits
          at topInset + gap(12)). The canvas itself flips addMode back off - via a marker tap or
          the map tap that drops the pin - so this control disappears on its own. */}
      {addMode ? (
        <View
          style={[styles.cancelWrap, { top: rt.insets.top + theme.gap(20) }]}
          pointerEvents="box-none"
        >
          <Button
            label={t('common.cancel')}
            variant="secondary"
            block={false}
            onPress={() => canvasRef.current?.cancelAddPlace()}
          />
        </View>
      ) : null}

      <NearbySheet
        places={places}
        people={people}
        userLoc={userLoc}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onRoutePlace={routeToPoi}
        onOpenPlace={openPoi}
        onFocusPerson={focusMember}
        onAddPlace={goAddPoi}
        snap={snap}
        onSnapChange={setSnap}
      />
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
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
  controlStack: {
    position: 'absolute',
    right: theme.gap(3),
    gap: theme.gap(3),
  },
  cancelWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
}))
