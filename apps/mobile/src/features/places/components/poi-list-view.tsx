import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { poiIconName } from '@/components/poi-icon-picker'
import { Screen } from '@/components/screen'
import { EmptyState, ListRow, SectionTitle, Skeleton, Surface } from '@/components/ui'
import { useTrip } from '@/features/trips'
import { useDeletePoi, usePois } from '@/features/wayfinder'
import { haptics } from '@/lib/haptics'

const SKELETON_ROWS = [0, 1, 2, 3]

export type PoiListViewProps = {
  tripId: string
}

// ----- Android: restyled POI list (no AppleMaps) -----

export function PoiListView({ tripId }: PoiListViewProps) {
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
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
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
}))
