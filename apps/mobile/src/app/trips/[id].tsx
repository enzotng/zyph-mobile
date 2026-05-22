import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { useTrip } from '@/features/trips'

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const { data: trip, isLoading, isError } = useTrip(id ?? '')

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  if (isError || !trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtitle}>Trip not found.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{trip.title}</Text>
      {trip.destination ? <Text style={styles.subtitle}>{trip.destination}</Text> : null}

      <View style={styles.row}>
        <Text style={styles.label}>Currency</Text>
        <Text style={styles.value}>{trip.currency}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Invite code</Text>
        <Text style={styles.value}>{trip.invite_code}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    gap: theme.gap(3),
    paddingHorizontal: theme.gap(6),
    paddingTop: rt.insets.top + theme.gap(4),
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  label: {
    color: theme.colors.muted,
  },
  value: {
    color: theme.colors.foreground,
    fontWeight: '600',
  },
}))
