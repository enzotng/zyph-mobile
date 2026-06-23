import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Switch, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { poiIconName } from '@/components/poi-icon-picker'
import { Screen } from '@/components/screen'
import { CityImage, Eyebrow, Spinner, Surface } from '@/components/ui'
import {
  POI_ICONS,
  type PoiIcon,
  type TripPoi,
  usePois,
  useShareLocation,
} from '@/features/wayfinder'
import { withAlpha } from '@/lib/color'
import { formatDistance, formatWalkingTime, haversine } from '@/lib/geo'
import { haptics } from '@/lib/haptics'
import { getShareLocation, setShareLocation } from '@/lib/preferences'
import { paramString } from '@/lib/routing'
import { useUserLocation } from '@/lib/sensors'

const HEADER_HEIGHT = 240

function eyebrowKey(icon: string): PoiIcon {
  return (POI_ICONS as readonly string[]).includes(icon) ? (icon as PoiIcon) : 'pin'
}

export default function PoiDetailScreen() {
  const params = useGlobalSearchParams<{ id: string; poiId: string }>()
  const tripId = paramString(params.id)
  const poiId = paramString(params.poiId)
  const router = useRouter()
  const { t } = useTranslation()
  const { theme, rt } = useUnistyles()

  const { data: pois, isLoading } = usePois(tripId)
  const poi = useMemo<TripPoi | undefined>(
    () => pois?.find((item) => item.id === poiId),
    [pois, poiId],
  )

  if (isLoading && !poi) {
    return (
      <Screen title={t('poiForm.editTitle')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (!poi) {
    return (
      <Screen title={t('poiDetail.deletedTitle')} showBack>
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('poiDetail.notFound')}</Text>
        </View>
      </Screen>
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Photo header: deterministic colour cover (POIs have no photo) + warm-ink scrim. */}
        <CityImage
          seed={poi.label}
          height={HEADER_HEIGHT + rt.insets.top}
          corners="all"
          scrim={false}
        >
          <View style={styles.headerScrim} pointerEvents="none" />

          <View style={styles.headerFoot}>
            <View style={styles.eyebrowRow}>
              <Ionicons name={poiIconName(poi.icon)} size={14} color="#F4F1E8" />
              <Eyebrow style={styles.eyebrow}>
                {t(`poiDetail.eyebrow.${eyebrowKey(poi.icon)}`)}
              </Eyebrow>
            </View>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {poi.label}
            </Text>
          </View>
        </CityImage>

        <PoiDetailSheet poi={poi} tripId={tripId} />
      </ScrollView>

      {/* Back button overlays the scroll, anchored to the safe-area top. */}
      <View style={[styles.backWrap, { top: rt.insets.top + theme.gap(2) }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#F4F1E8" />
        </Pressable>
      </View>
    </View>
  )
}

function PoiDetailSheet({ poi, tripId }: { poi: TripPoi; tripId: string }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  const user = useUserLocation(true, 'coarse')
  const userLoc = user.location
  const distance = userLoc ? haversine(userLoc, { lat: poi.lat, lng: poi.lng }) : null

  function routeInAr() {
    router.push({
      pathname: '/trips/[id]/ar',
      params: { id: tripId, target: `poi:${poi.id}` },
    })
  }

  function openInMap() {
    router.navigate({
      pathname: '/trips/[id]/pois',
      params: { id: tripId, focus: `poi:${poi.id}` },
    })
  }

  function editPoi() {
    router.push({
      pathname: '/trips/[id]/pois/[poiId]/edit',
      params: { id: tripId, poiId: poi.id },
    })
  }

  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.sheet}>
      <Surface
        corners="top"
        color={theme.colors.background}
        borderWidth={0}
        radius={theme.radius.xl}
        style={styles.sheetSurface}
      >
        <View style={styles.statRow}>
          <StatTile
            icon="walk-outline"
            value={distance !== null ? formatDistance(distance) : '-'}
            label={t('poiDetail.away')}
          />
          <StatTile
            icon="time-outline"
            value={distance !== null ? formatWalkingTime(distance) : '-'}
            label={t('poiDetail.walk')}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label={t('poiDetail.routeInAr')}
            variant="accent"
            icon="navigate"
            onPress={routeInAr}
          />
          <View style={styles.actionsRow}>
            <View style={styles.actionFlex}>
              <Button
                label={t('poiDetail.openInMap')}
                variant="secondary"
                icon="map-outline"
                onPress={openInMap}
              />
            </View>
            <View style={styles.actionFlex}>
              <Button
                label={t('poiDetail.edit')}
                variant="secondary"
                icon="create-outline"
                onPress={editPoi}
              />
            </View>
          </View>
        </View>

        <ShareLocationCard tripId={tripId} />
      </Surface>
    </Animated.View>
  )
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap
  value: string
  label: string
}) {
  const { theme } = useUnistyles()
  return (
    <Surface
      color={theme.colors.card}
      borderColor={theme.colors.border}
      borderWidth={1}
      radius={theme.radius.lg}
      style={styles.statTile}
    >
      <Ionicons name={icon} size={20} color={theme.colors.primary} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </Surface>
  )
}

// First UI surfacing useShareLocation as a real Switch. State is persisted per-trip in MMKV so it
// matches the group screen; the hook owns the GPS watcher + remote upsert/clear and reports status.
function ShareLocationCard({ tripId }: { tripId: string }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  const [sharing, setSharing] = useState(() => getShareLocation(tripId))
  const { status } = useShareLocation({ tripId, enabled: sharing })

  useEffect(() => {
    setShareLocation(tripId, sharing)
  }, [sharing, tripId])

  function onToggle(next: boolean) {
    haptics.selection()
    setSharing(next)
  }

  const subtitle =
    status === 'denied'
      ? t('poiDetail.sharingDenied')
      : status === 'error'
        ? t('poiDetail.sharingError')
        : status === 'requesting'
          ? t('poiDetail.sharingRequesting')
          : sharing
            ? t('poiDetail.sharingOnSub')
            : t('poiDetail.sharingOffSub')

  return (
    <Surface
      color={withAlpha(theme.colors.success, 0.1)}
      borderColor={withAlpha(theme.colors.success, 0.22)}
      borderWidth={1}
      radius={theme.radius.lg}
      style={styles.shareCard}
    >
      <View
        style={[styles.shareIconTile, { backgroundColor: withAlpha(theme.colors.success, 0.16) }]}
      >
        <Ionicons
          name={sharing ? 'location' : 'location-outline'}
          size={20}
          color={theme.colors.success}
        />
      </View>
      <View style={styles.shareInfo}>
        <Text style={styles.shareTitle}>{t('poiDetail.sharingTitle')}</Text>
        <Text style={styles.shareSub} numberOfLines={3}>
          {subtitle}
        </Text>
      </View>
      <Switch
        value={sharing}
        onValueChange={onToggle}
        trackColor={{ false: theme.colors.border, true: theme.colors.success }}
        accessibilityLabel={t('poiDetail.sharingTitle')}
        accessibilityState={{ checked: sharing }}
      />
    </Surface>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.gap(6),
  },
  notFound: {
    textAlign: 'center',
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: withAlpha('#1A1712', 0.32),
  },
  backWrap: {
    position: 'absolute',
    left: theme.gap(4),
  },
  backBtn: {
    width: theme.gap(10),
    height: theme.gap(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.gap(5),
    backgroundColor: withAlpha('#1A1712', 0.5),
    borderWidth: 1,
    borderColor: withAlpha('#F4F1E8', 0.12),
  },
  headerFoot: {
    position: 'absolute',
    left: theme.gap(5),
    right: theme.gap(5),
    bottom: theme.gap(8),
    gap: theme.gap(2),
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
  },
  eyebrow: {
    color: '#F4F1E8',
  },
  headerTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: 26,
    color: '#F4F1E8',
  },
  sheet: {
    flex: 1,
    // Overlap the header so the rounded sheet rises over the photo cover.
    marginTop: -theme.gap(6),
  },
  sheetSurface: {
    flex: 1,
    paddingTop: theme.gap(5),
    paddingHorizontal: theme.gap(5),
    paddingBottom: rt.insets.bottom + theme.gap(8),
    gap: theme.gap(4),
    shadowColor: '#1A1712',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: theme.gap(3),
  },
  statTile: {
    flex: 1,
    alignItems: 'flex-start',
    gap: theme.gap(1),
    padding: theme.gap(4),
  },
  statValue: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
  },
  statLabel: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  actions: {
    gap: theme.gap(3),
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.gap(3),
  },
  actionFlex: {
    flex: 1,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    padding: theme.gap(4),
  },
  shareIconTile: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  shareInfo: {
    flex: 1,
    minWidth: 0,
    gap: theme.gap(0.5),
  },
  shareTitle: {
    fontFamily: theme.fonts.display.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  shareSub: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
}))
