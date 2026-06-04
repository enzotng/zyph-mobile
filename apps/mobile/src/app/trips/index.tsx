import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, RefreshControl, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { BottomSheet, EmptyState, Spinner } from '@/components/ui'
import { useTrips } from '@/features/trips'
import { TripListCard } from '@/features/trips/components/trip-list-card'

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
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('trips.add')}
          hitSlop={8}
        >
          <Ionicons name="add" size={28} color={theme.colors.primary} />
        </Pressable>
      }
    >
      {isLoading ? (
        <View style={styles.center}>
          <Spinner label={t('common.loading')} />
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
        />
      ) : (
        <View style={styles.listWrap}>
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
              <TripListCard
                trip={item}
                onPress={() => router.push({ pathname: '/trips/[id]', params: { id: item.id } })}
              />
            )}
          />
        </View>
      )}

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={t('trips.add')}>
        <View style={styles.sheetActions}>
          <Button
            label={t('trips.create')}
            icon="add"
            onPress={() => {
              setAddOpen(false)
              router.push('/trips/new')
            }}
          />
          <Button
            label={t('trips.join')}
            variant="secondary"
            icon="enter-outline"
            onPress={() => {
              setAddOpen(false)
              router.push('/trips/join')
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listWrap: {
    flex: 1,
  },
  list: {
    paddingVertical: theme.gap(3),
    paddingBottom: rt.insets.bottom + theme.gap(4),
  },
  sheetActions: {
    gap: theme.gap(2),
  },
}))
