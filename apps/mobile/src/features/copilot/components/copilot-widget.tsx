import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Amount, Avatar, Surface } from '@/components/ui'
import { useExpenses, useTripBalances } from '@/features/expenses'
import { useTripMembers } from '@/features/group'
import { groupReadiness, usePackingItems } from '@/features/packing'
import { iconForCode, labelKeyForCode } from '@/features/taxonomy'
import { useEvents } from '@/features/timeline'
import { useTrip } from '@/features/trips'
import { useTripWeather, WeatherCard } from '@/features/weather'
import { withAlpha } from '@/lib/color'

import type { CopilotWidgetType } from '../schemas'
import { expensesByCategory } from '../widgets'

// Renders the trip card the copilot chose to attach to its answer. The model only picks the type;
// every figure here is read from the screen's own cached query data, so it is always real and
// current (the LLM never produces the numbers). A widget renders nothing until its data is ready.
export function CopilotWidget({ type, tripId }: { type: CopilotWidgetType; tripId: string }) {
  switch (type) {
    case 'weather':
      return <WeatherWidget tripId={tripId} />
    case 'balances':
      return <BalancesWidget tripId={tripId} />
    case 'next_events':
      return <NextEventsWidget tripId={tripId} />
    case 'packing':
      return <PackingWidget tripId={tripId} />
    case 'expenses':
      return <ExpensesWidget tripId={tripId} />
    case 'spend_by_category':
      return <SpendByCategoryWidget tripId={tripId} />
    default:
      return null
  }
}

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useUnistyles()
  return (
    <Surface
      color={theme.colors.card}
      borderColor={theme.colors.border}
      borderWidth={1}
      radius={theme.radius.lg}
      style={styles.card}
    >
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </Surface>
  )
}

function WeatherWidget({ tripId }: { tripId: string }) {
  const trip = useTrip(tripId)
  const weather = useTripWeather(trip.data)
  if (!weather.data) {
    return null
  }
  return <WeatherCard weather={weather.data} />
}

function BalancesWidget({ tripId }: { tripId: string }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const balances = useTripBalances(tripId)
  const members = useTripMembers(tripId)
  const trip = useTrip(tripId)
  if (!balances.data?.length || !members.data || !trip.data) {
    return null
  }
  const memberById = new Map(members.data.map((m) => [m.id, m]))
  const rows = [...balances.data].sort((a, b) => b.balance_cents - a.balance_cents).slice(0, 6)

  return (
    <WidgetCard title={t('copilot.widget.balances')}>
      {rows.map((balance) => {
        const member = memberById.get(balance.member_id)
        const name = member?.display_name ?? t('common.member')
        return (
          <View key={balance.member_id} style={styles.row}>
            <Avatar
              name={name}
              imageUrl={member?.avatar_url}
              size={28}
              tint={theme.colors.primary}
            />
            <Text style={styles.rowLabel} numberOfLines={1}>
              {name}
            </Text>
            <Amount cents={balance.balance_cents} currency={trip.data.currency} size={14} signed />
          </View>
        )
      })}
    </WidgetCard>
  )
}

function NextEventsWidget({ tripId }: { tripId: string }) {
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const events = useEvents(tripId)
  if (!events.data) {
    return null
  }
  // Local start-of-day so an event happening today still counts as upcoming.
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const upcoming = events.data
    .filter((event) => event.starts_at && new Date(event.starts_at) >= startOfToday)
    .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))
    .slice(0, 3)

  return (
    <WidgetCard title={t('copilot.widget.nextEvents')}>
      {upcoming.length === 0 ? (
        <Text style={styles.empty}>{t('copilot.widget.noUpcoming')}</Text>
      ) : (
        upcoming.map((event) => (
          <View key={event.id} style={styles.row}>
            <Ionicons
              name={iconForCode(event.category, event.subcategory)}
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.rowLabel} numberOfLines={1}>
              {event.title}
            </Text>
            <Text style={styles.rowMeta}>
              {event.starts_at
                ? new Date(event.starts_at).toLocaleDateString(i18n.language, {
                    day: 'numeric',
                    month: 'short',
                  })
                : ''}
            </Text>
          </View>
        ))
      )}
    </WidgetCard>
  )
}

function PackingWidget({ tripId }: { tripId: string }) {
  const { t } = useTranslation()
  const packing = usePackingItems(tripId)
  if (!packing.data?.length) {
    return null
  }
  const total = packing.data.length
  const packed = packing.data.filter((item) => item.packed).length
  const { percent } = groupReadiness(packing.data)

  return (
    <WidgetCard title={t('copilot.widget.packing')}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
      <Text style={styles.rowMeta}>{t('copilot.widget.packed', { packed, total })}</Text>
    </WidgetCard>
  )
}

function ExpensesWidget({ tripId }: { tripId: string }) {
  const { t } = useTranslation()
  const expenses = useExpenses(tripId)
  const trip = useTrip(tripId)
  if (!expenses.data?.length || !trip.data) {
    return null
  }
  const rows = expensesByCategory(expenses.data).slice(0, 5)

  return (
    <WidgetCard title={t('copilot.widget.expenses')}>
      {rows.map((row) => (
        <View key={row.category ?? 'uncategorized'} style={styles.row}>
          <Text style={styles.rowLabel} numberOfLines={1}>
            {row.category ? t(labelKeyForCode(row.category)) : t('copilot.widget.uncategorized')}
          </Text>
          <Amount cents={row.cents} currency={trip.data.currency} size={14} neutral />
        </View>
      ))}
    </WidgetCard>
  )
}

const TOP_N = 5

function SpendByCategoryWidget({ tripId }: { tripId: string }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const expenses = useExpenses(tripId)
  const trip = useTrip(tripId)
  if (!expenses.data?.length || !trip.data) {
    return null
  }
  const rows = expensesByCategory(expenses.data).slice(0, TOP_N)
  const maxCents = rows[0]?.cents ?? 0
  if (maxCents === 0) {
    return null
  }

  return (
    <WidgetCard title={t('copilot.widget.spendByCategory')}>
      {rows.map((row) => {
        const fillPercent = (row.cents / maxCents) * 100
        return (
          <View key={row.category ?? 'uncategorized'} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {row.category ? t(labelKeyForCode(row.category)) : t('copilot.widget.uncategorized')}
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${fillPercent}%`,
                    backgroundColor: withAlpha(theme.colors.primary, 0.75),
                  },
                ]}
              />
            </View>
            <Amount cents={row.cents} currency={trip.data.currency} size={13} neutral />
          </View>
        )
      })}
    </WidgetCard>
  )
}

const styles = StyleSheet.create((theme) => ({
  card: {
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(3.5),
    gap: theme.gap(2),
  },
  cardTitle: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
  },
  rowLabel: {
    flex: 1,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  rowMeta: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  empty: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  progressTrack: {
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  barLabel: {
    width: 90,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.xs,
    color: theme.colors.foreground,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.border, 0.6),
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: theme.radius.full,
  },
}))
