import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { poiIconName } from '@/components/poi-icon-picker'
import { Screen } from '@/components/screen'
import { Squircle } from '@/components/ui'
import { useDeletePoi, usePois } from '@/features/wayfinder'
import { paramString } from '@/lib/routing'

export default function PoisScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
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

  if (isLoading) {
    return (
      <Screen title="POIs" showBack>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen title="POIs" showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>Could not load POIs.</Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen title="POIs" showBack>
      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>Custom waypoints for AR navigation.</Text>
        <Link
          href={{ pathname: '/trips/[id]/pois/new', params: { id: tripId } }}
          style={styles.addLink}
        >
          Add
        </Link>
      </View>

      <FlashList
        data={pois ?? []}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.muted}>
            No POIs yet. Add gates, restrooms or any custom waypoint.
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

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.gap(3),
  },
  subtitle: {
    flexShrink: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  addLink: {
    color: theme.colors.primary,
    fontWeight: '600',
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
