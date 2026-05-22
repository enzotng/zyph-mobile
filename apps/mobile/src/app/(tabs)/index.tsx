import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { type Trip, useTrips } from '@/features/trips'

export default function TripsScreen() {
  const router = useRouter()
  const { data: trips, isLoading, isError, refetch } = useTrips()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My trips</Text>

      {isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Could not load your trips.</Text>
          <Button label="Retry" variant="secondary" onPress={() => void refetch()} />
        </View>
      ) : !trips || trips.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.muted}>Create your first trip to get started.</Text>
        </View>
      ) : (
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
      )}

      <View style={styles.footer}>
        <Button label="Create a trip" onPress={() => router.push('/trips/new')} />
        <Button
          label="Join by code"
          variant="secondary"
          onPress={() => router.push('/trips/join')}
        />
      </View>
    </View>
  )
}

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <Text style={styles.cardTitle}>{trip.title}</Text>
      {trip.destination ? <Text style={styles.muted}>{trip.destination}</Text> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    paddingTop: rt.insets.top + theme.gap(2),
    paddingHorizontal: theme.gap(6),
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.foreground,
    paddingVertical: theme.gap(2),
  },
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
  list: {
    paddingVertical: theme.gap(3),
  },
  card: {
    padding: theme.gap(4),
    marginBottom: theme.gap(3),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    gap: theme.gap(1),
  },
  cardTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  footer: {
    gap: theme.gap(2),
    paddingVertical: theme.gap(3),
    paddingBottom: rt.insets.bottom + theme.gap(3),
  },
}))
