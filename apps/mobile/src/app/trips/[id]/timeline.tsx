import { FlashList } from '@shopify/flash-list'
import { Link, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { groupEventsByDay, type TimelineItem, useEvents } from '@/features/timeline'

export default function TimelineScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? ''
  const { data: events } = useEvents(tripId)
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
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Timeline</Text>
        <Link
          href={{ pathname: '/trips/[id]/add-event', params: { id: tripId } }}
          style={styles.link}
        >
          Add event
        </Link>
      </View>

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
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    paddingHorizontal: theme.gap(6),
    paddingTop: rt.insets.top + theme.gap(4),
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: theme.gap(2),
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
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
