import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { Link, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { groupEventsByDay, type TimelineItem, useEvents } from '@/features/timeline'

export default function TimelineScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? ''
  const { data: events } = useEvents(tripId)
  const { theme } = useUnistyles()
  const items = useMemo(() => groupEventsByDay(events ?? []), [events])

  const renderItem = useCallback(
    ({ item }: { item: TimelineItem }) =>
      item.kind === 'header' ? (
        <Text style={styles.dayHeader}>{item.label}</Text>
      ) : (
        <View style={styles.eventRow}>
          <Text style={styles.eventTitle}>{item.event.title}</Text>
          {item.event.notes ? <Text style={styles.muted}>{item.event.notes}</Text> : null}
        </View>
      ),
    [],
  )

  return (
    <Screen
      title="Timeline"
      right={
        <Link href={{ pathname: '/trips/[id]/add-event', params: { id: tripId } }} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Add event" hitSlop={8}>
            <Ionicons name="add" size={26} color={theme.colors.primary} />
          </Pressable>
        </Link>
      }
    >
      {items.length === 0 ? (
        <Text style={styles.muted}>Add your first event.</Text>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  muted: {
    color: theme.colors.muted,
  },
  list: {
    paddingBottom: rt.insets.bottom + theme.gap(4),
  },
  dayHeader: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.muted,
    paddingTop: theme.gap(4),
    paddingBottom: theme.gap(1),
  },
  eventRow: {
    gap: theme.gap(1),
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  eventTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
}))
