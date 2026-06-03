import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { poiIconName } from '@/components/poi-icon-picker'
import { Screen } from '@/components/screen'
import { QuickAction, Squircle } from '@/components/ui'
import { useTrip } from '@/features/trips'
import { useDeletePoi, usePois } from '@/features/wayfinder'
import { paramString } from '@/lib/routing'

export default function PoisScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { data: trip } = useTrip(tripId)
  const { data: pois, isLoading, isError } = usePois(tripId)
  const deletePoi = useDeletePoi(tripId)

  function confirmDelete(poiId: string, label: string) {
    Alert.alert('Delete POI', `Remove "${label}" from this trip?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePoi.mutateAsync(poiId)
          } catch (error) {
            Alert.alert(
              'Could not delete',
              error instanceof Error ? error.message : 'Please try again.',
            )
          }
        },
      },
    ])
  }

  const addButton = (
    <Pressable
      onPress={() => router.push({ pathname: '/trips/[id]/pois/new', params: { id: tripId } })}
      accessibilityRole="button"
      accessibilityLabel="Add a waypoint"
      hitSlop={8}
    >
      <Ionicons name="add" size={26} color={theme.colors.foreground} />
    </Pressable>
  )

  const wayfinder = (
    <View style={styles.wayfinder}>
      <QuickAction
        icon="map"
        label="Map"
        onPress={() => router.push({ pathname: '/trips/[id]/map', params: { id: tripId } })}
      />
      <QuickAction
        icon="scan"
        label="AR view"
        onPress={() => router.push({ pathname: '/trips/[id]/ar', params: { id: tripId } })}
      />
    </View>
  )

  if (isLoading) {
    return (
      <Screen title={trip?.title} showBack right={addButton}>
        {wayfinder}
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen title={trip?.title} showBack right={addButton}>
        {wayfinder}
        <View style={styles.center}>
          <Text style={styles.muted}>Could not load waypoints.</Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen title={trip?.title} showBack right={addButton}>
      {wayfinder}
      <Text style={styles.caption}>Custom waypoints for the map and AR navigation.</Text>

      <FlashList
        data={pois ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.muted}>
            No waypoints yet. Add gates, restrooms or any custom spot.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: '/trips/[id]/pois/[poiId]/edit',
                params: { id: tripId, poiId: item.id },
              })
            }
            accessibilityRole="button"
          >
            <Squircle
              color={theme.colors.card}
              borderWidth={0}
              radius={theme.radius.md}
              width={theme.gap(10)}
              height={theme.gap(10)}
              style={styles.iconWrap}
            >
              <Ionicons name={poiIconName(item.icon)} size={20} />
            </Squircle>
            <Text style={styles.label}>{item.label}</Text>
            <Pressable
              onPress={() => confirmDelete(item.id, item.label)}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.label}`}
              hitSlop={8}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </Pressable>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wayfinder: {
    flexDirection: 'row',
    gap: theme.gap(3),
    paddingBottom: theme.gap(2),
  },
  caption: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    paddingBottom: theme.gap(3),
  },
  list: {
    paddingBottom: rt.insets.bottom + FLOATING_TAB_BAR_CLEARANCE,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.gap(10),
    height: theme.gap(10),
  },
  label: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  muted: {
    color: theme.colors.muted,
    paddingTop: theme.gap(3),
  },
  deleteText: {
    color: theme.colors.destructive,
    fontWeight: '600',
  },
}))
