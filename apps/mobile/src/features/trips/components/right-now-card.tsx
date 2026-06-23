import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Eyebrow } from '@/components/ui'
import type { TripEvent } from '@/features/timeline'

// Text sits on the ink bezel (dark in both themes), so colours stay light/fixed.
const CREAM = '#F4F1E8'
const CREAM_MUTED = 'rgba(244, 241, 232, 0.6)'
const LIVE_GREEN = '#5FB98C'

// The "right now" card: the event currently in progress, with an elapsed-progress bar and the
// time remaining. Rendered only when an event is in progress (the parent decides).
export function RightNowCard({ event, now: initialNow }: { event: TripEvent; now: number }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  // The card is explicitly "live", so it ticks on its own (the parent seeds the first value).
  // A 30s cadence keeps the progress bar and time-left honest without per-second churn.
  const [now, setNow] = useState(initialNow)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const start = event.starts_at ? new Date(event.starts_at).getTime() : now
  const end = event.ends_at ? new Date(event.ends_at).getTime() : now
  const span = Math.max(1, end - start)
  const progress = Math.min(1, Math.max(0, (now - start) / span))

  const minutesLeft = Math.max(0, Math.round((end - now) / 60_000))
  const timeLeft =
    minutesLeft >= 60
      ? t('trip.hoursLeft', { hours: Math.floor(minutesLeft / 60), minutes: minutesLeft % 60 })
      : t('trip.minutesLeft', { minutes: minutesLeft })

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Eyebrow style={styles.eyebrow}>{t('trip.rightNow')}</Eyebrow>
        <Text style={styles.status}>{t('home.inProgress')}</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {event.title}
      </Text>
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.colors.primary },
            ]}
          />
        </View>
        {event.ends_at ? <Text style={styles.left}>{timeLeft}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.bezel,
    paddingVertical: theme.gap(4),
    paddingHorizontal: theme.gap(4.5),
    gap: theme.gap(2.5),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 11,
    color: CREAM_MUTED,
  },
  status: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: LIVE_GREEN,
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: CREAM,
    letterSpacing: -0.3,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(244, 241, 232, 0.14)',
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: theme.radius.full,
  },
  left: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
    color: CREAM_MUTED,
  },
}))
