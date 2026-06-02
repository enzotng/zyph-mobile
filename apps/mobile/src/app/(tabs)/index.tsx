import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import { BottomSheet, Squircle } from '@/components/ui'
import { type Trip, useTrips } from '@/features/trips'

export default function TripsScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { data: trips, isLoading, isError, refetch } = useTrips()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <Screen
      title="My trips"
      showBack={false}
      right={
        <Pressable
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add a trip"
          hitSlop={8}
        >
          <Ionicons name="add" size={26} color={theme.colors.foreground} />
        </Pressable>
      }
    >
      {isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Could not load your trips.</Text>
          <Button label="Retry" variant="secondary" onPress={() => void refetch()} block={false} />
        </View>
      ) : !trips || trips.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.muted}>Create your first trip to get started.</Text>
          <Button label="Create a trip" onPress={() => router.push('/trips/new')} block={false} />
        </View>
      ) : (
        <View style={styles.listWrap}>
          <FlashList
            data={trips}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TripCard
                trip={item}
                onPress={() => router.push({ pathname: '/trips/[id]', params: { id: item.id } })}
              />
            )}
          />
        </View>
      )}

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add a trip">
        <View style={styles.sheetActions}>
          <Button
            label="Create a trip"
            onPress={() => {
              setAddOpen(false)
              router.push('/trips/new')
            }}
          />
          <Button
            label="Join by code"
            variant="secondary"
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

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const { theme } = useUnistyles()
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Squircle
        color={theme.colors.card}
        borderColor={theme.colors.border}
        borderWidth={1}
        radius={theme.radius.lg}
        style={styles.card}
      >
        <Text style={styles.cardTitle}>{trip.title}</Text>
        {trip.destination ? <Text style={styles.muted}>{trip.destination}</Text> : null}
      </Squircle>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(2),
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  muted: {
    color: theme.colors.muted,
  },
  listWrap: {
    flex: 1,
  },
  list: {
    paddingVertical: theme.gap(3),
    paddingBottom: rt.insets.bottom + FLOATING_TAB_BAR_CLEARANCE,
  },
  card: {
    padding: theme.gap(4),
    marginBottom: theme.gap(3),
    gap: theme.gap(1),
  },
  cardTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  sheetActions: {
    gap: theme.gap(2),
  },
}))
