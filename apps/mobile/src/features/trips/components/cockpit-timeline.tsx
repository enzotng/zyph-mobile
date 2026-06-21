import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { eventStatus, eventTypeIcon, formatCountdown, type TripEvent } from '@/features/timeline'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

// The cockpit "what's next" rail: the next few upcoming events. The first is a bordered NEXT
// card, the rest are compact rows, all threaded on a vertical timeline rail.
export function CockpitTimeline({
  events,
  now,
  onPressEvent,
}: {
  events: TripEvent[]
  now: number
  onPressEvent: (id: string) => void
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  if (events.length === 0) {
    return null
  }

  return (
    <View>
      {events.map((event, index) => {
        const status = eventStatus(event.starts_at, event.ends_at, now)
        const countdown = status.kind === 'upcoming' ? formatCountdown(status, t) : null
        const isFirst = index === 0
        const isLast = index === events.length - 1
        const press = () => {
          haptics.light()
          onPressEvent(event.id)
        }

        return (
          <View key={event.id} style={styles.item}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  isFirst && {
                    borderWidth: 3,
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.background,
                  },
                ]}
              />
              {!isLast ? <View style={styles.line} /> : null}
            </View>

            {isFirst ? (
              <Pressable
                onPress={press}
                accessibilityRole="button"
                accessibilityLabel={event.title}
                style={({ pressed }) => [styles.nextCard, pressed && styles.pressed]}
              >
                <View
                  style={[
                    styles.iconTile,
                    { backgroundColor: withAlpha(theme.colors.primary, 0.1) },
                  ]}
                >
                  <Ionicons
                    name={eventTypeIcon(event.type)}
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.nextBody}>
                  <Text style={styles.nextEyebrow}>{t('home.next')}</Text>
                  <Text style={styles.nextTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  {event.notes ? (
                    <Text style={styles.sub} numberOfLines={1}>
                      {event.notes}
                    </Text>
                  ) : null}
                </View>
                {countdown ? <Text style={styles.countdown}>{countdown}</Text> : null}
              </Pressable>
            ) : (
              <Pressable
                onPress={press}
                accessibilityRole="button"
                accessibilityLabel={event.title}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowIconTile}>
                  <Ionicons name={eventTypeIcon(event.type)} size={18} color={theme.colors.muted} />
                </View>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {event.title}
                </Text>
                {countdown ? <Text style={styles.rowCountdown}>{countdown}</Text> : null}
              </Pressable>
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  item: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.gap(3.5),
  },
  rail: {
    width: 14,
    alignItems: 'center',
    paddingTop: theme.gap(1),
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: theme.gap(1),
    backgroundColor: theme.colors.border,
  },
  nextCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    marginBottom: theme.gap(3.5),
    padding: theme.gap(2.5),
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBody: {
    flex: 1,
    gap: 1,
  },
  nextEyebrow: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.primary,
  },
  nextTitle: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  sub: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  countdown: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(1),
    marginBottom: theme.gap(3.5),
  },
  rowIconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(theme.colors.muted, 0.12),
  },
  rowTitle: {
    flex: 1,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  rowCountdown: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  pressed: {
    opacity: 0.85,
  },
}))
