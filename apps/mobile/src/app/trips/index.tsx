import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, RefreshControl, View } from 'react-native'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { EmptyState, Skeleton } from '@/components/ui'
import { useTrips } from '@/features/trips'
import { AddTripSheet } from '@/features/trips/components/add-trip-sheet'
import { TripListCard } from '@/features/trips/components/trip-list-card'
import { haptics } from '@/lib/haptics'

// Placeholder rows shown while the list loads, sized to roughly match a TripListCard.
const SKELETON_ROWS = [0, 1, 2, 3]

// The full "all trips" list, reached from the home "See all" action.
export default function AllTripsScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const { data: trips, isLoading, isError, isRefetching, refetch } = useTrips()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <Screen
      title={t('trips.title')}
      showBack
      right={
        <Pressable
          onPress={() => {
            haptics.light()
            setAddOpen(true)
          }}
          accessibilityRole="button"
          accessibilityLabel={t('trips.addTitle')}
          hitSlop={8}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Ionicons name="add" size={28} color={theme.colors.primary} />
        </Pressable>
      }
    >
      {isLoading ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((row) => (
            <Skeleton key={row} height={184} radius={theme.radius.lg} style={styles.skeletonRow} />
          ))}
        </View>
      ) : isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t('trips.errorTitle')}
          body={t('trips.error')}
          cta={t('common.retry')}
          onCta={() => void refetch()}
        />
      ) : !trips || trips.length === 0 ? (
        <EmptyState
          icon="airplane-outline"
          title={t('trips.empty.title')}
          body={t('trips.empty.body')}
          cta={t('trips.create')}
          onCta={() => router.push('/trips/new')}
          secondaryCta={t('trips.join')}
          onSecondaryCta={() => router.push('/trips/join')}
        />
      ) : (
        <Animated.View style={styles.listWrap} entering={FadeIn.duration(300)}>
          <FlashList
            data={trips}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void refetch()}
                tintColor={theme.colors.primary}
              />
            }
            renderItem={({ item }) => (
              // No `entering` here: FlashList recycles rows, so a mount animation would
              // re-fire on every scroll. `layout` only, for tasteful reorder transitions.
              <Animated.View layout={LinearTransition}>
                <TripListCard
                  trip={item}
                  onPress={() => router.push({ pathname: '/trips/[id]', params: { id: item.id } })}
                />
              </Animated.View>
            )}
          />
        </Animated.View>
      )}

      <AddTripSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  listWrap: {
    flex: 1,
  },
  list: {
    paddingVertical: theme.gap(3),
    paddingBottom: rt.insets.bottom + theme.gap(4),
  },
  skeletonRow: {
    marginBottom: theme.gap(3.5),
  },
}))
