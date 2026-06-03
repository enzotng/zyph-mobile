import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import {
  AvatarStack,
  Badge,
  Card,
  CityImage,
  QuickAction,
  SectionTitle,
  Spinner,
  Squircle,
} from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  type ExpenseCategory,
  formatAmount,
  settleBalances,
  useExpenses,
  useTripBalances,
} from '@/features/expenses'
import { useTripMembers } from '@/features/group'
import { eventStatus, formatCountdown, useEvents } from '@/features/timeline'
import { useTrip } from '@/features/trips'
import { withAlpha } from '@/lib/color'
import { paramString } from '@/lib/routing'

const CATEGORY_ICON: Record<ExpenseCategory, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant',
  transport: 'car',
  lodging: 'bed',
  activity: 'ticket',
  shopping: 'bag-handle',
  other: 'pricetag',
}

export default function TripDashboardScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user.id

  const { data: trip, isLoading, isError } = useTrip(tripId)
  const { data: balances } = useTripBalances(tripId)
  const { data: members } = useTripMembers(tripId)
  const { data: events } = useEvents(tripId)
  const { data: expenses } = useExpenses(tripId)
  // Snapshot once on mount; the countdown badge does not need to tick on this screen.
  const [now] = useState(() => Date.now())

  function goGroup() {
    router.push({ pathname: '/trips/[id]/group', params: { id: tripId } })
  }
  function goTab(name: 'timeline' | 'expenses' | 'pois') {
    router.navigate({ pathname: `/trips/[id]/${name}`, params: { id: tripId } })
  }

  if (isLoading) {
    return (
      <Screen showBack>
        <View style={styles.center}>
          <Spinner label={t('common.loading')} />
        </View>
      </Screen>
    )
  }

  if (isError || !trip) {
    return (
      <Screen title={t('trip.notFound')} showBack>
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('trip.notFound')}</Text>
        </View>
      </Screen>
    )
  }

  const currency = trip.currency
  const myMember = (members ?? []).find((member) => member.user_id === userId)
  const myBalance =
    (balances ?? []).find((balance) => balance.user_id === userId)?.balance_cents ?? 0
  const settled = myBalance === 0
  const positive = myBalance > 0

  const settlements = settleBalances(
    (balances ?? []).map((balance) => ({
      memberId: balance.member_id,
      balanceCents: balance.balance_cents ?? 0,
    })),
  )
  const debtorNames = myMember
    ? settlements
        .filter((settlement) => settlement.toMemberId === myMember.id)
        .map(
          (settlement) =>
            (members ?? []).find((member) => member.id === settlement.fromMemberId)?.display_name ??
            'Member',
        )
    : []

  const balanceTone = settled
    ? theme.colors.foreground
    : positive
      ? theme.colors.success
      : theme.colors.destructive
  const balanceSub = settled
    ? t('trip.settledSub')
    : positive
      ? t('trip.owedSub', { names: debtorNames.join(', ') })
      : t('trip.oweSub')

  const avatarMembers = (members ?? []).map((member) => ({
    id: member.id,
    name: member.display_name ?? undefined,
  }))

  const nextEvent = (events ?? []).find(
    (event) => eventStatus(event.starts_at, event.ends_at, now).kind === 'upcoming',
  )
  const nextStatus = nextEvent ? eventStatus(nextEvent.starts_at, nextEvent.ends_at, now) : null

  const recent = (expenses ?? []).slice(0, 3)

  function payerName(memberId: string | null): string {
    const member = (members ?? []).find((m) => m.id === memberId)
    return member?.display_name ?? 'Member'
  }

  return (
    <Screen
      title={trip.title}
      showBack
      scroll
      right={
        <Pressable
          onPress={goGroup}
          accessibilityRole="button"
          accessibilityLabel={t('trip.manage')}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.foreground} />
        </Pressable>
      }
    >
      {/* Cover hero */}
      <CityImage uri={trip.cover_photo_url} seed={trip.destination ?? trip.title} height={132}>
        <View style={styles.coverOverlay}>
          <View style={styles.coverInfo}>
            {trip.destination ? (
              <View style={styles.coverRow}>
                <Ionicons name="location" size={14} color="#FFFFFF" />
                <Text style={styles.coverDestination}>{trip.destination}</Text>
              </View>
            ) : null}
          </View>
          <Pressable onPress={goGroup} style={styles.manage} accessibilityRole="button">
            {avatarMembers.length > 0 ? <AvatarStack members={avatarMembers} size={32} /> : null}
            <Text style={styles.manageLabel}>{t('trip.manage')}</Text>
          </Pressable>
        </View>
      </CityImage>

      {/* Balance hero */}
      <Card>
        <View style={styles.balanceRow}>
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>
              {settled ? t('trip.settled') : positive ? t('trip.owed') : t('trip.owe')}
            </Text>
            <Text style={[styles.balanceAmount, { color: balanceTone }]}>
              {formatAmount(Math.abs(myBalance), currency)}
            </Text>
            <Text style={styles.balanceSub}>{balanceSub}</Text>
          </View>
          <Squircle
            width={48}
            height={48}
            radius={theme.radius.md}
            borderWidth={0}
            color={withAlpha(settled ? theme.colors.success : theme.colors.primary, 0.12)}
            style={styles.balanceIcon}
          >
            <Ionicons
              name={settled ? 'checkmark-done' : 'git-compare-outline'}
              size={24}
              color={settled ? theme.colors.success : theme.colors.primary}
            />
          </Squircle>
        </View>
        <View style={styles.balanceButton}>
          <Button
            label={settled ? t('trip.viewBalances') : t('trip.settle')}
            icon="git-compare-outline"
            variant={settled ? 'secondary' : 'primary'}
            onPress={goGroup}
          />
        </View>
      </Card>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <QuickAction
          icon="scan"
          label={t('trip.scan')}
          onPress={() =>
            router.push({ pathname: '/trips/[id]/add-expense', params: { id: tripId } })
          }
        />
        <QuickAction
          icon="add-circle"
          label={t('trip.expense')}
          onPress={() =>
            router.push({ pathname: '/trips/[id]/add-expense', params: { id: tripId } })
          }
        />
        <QuickAction
          icon="map"
          label={t('trip.map')}
          onPress={() => router.push({ pathname: '/trips/[id]/map', params: { id: tripId } })}
        />
        <QuickAction
          icon="navigate"
          label={t('trip.ar')}
          onPress={() => router.push({ pathname: '/trips/[id]/ar', params: { id: tripId } })}
        />
      </View>

      {/* Next event */}
      {nextEvent && nextStatus?.kind === 'upcoming' ? (
        <View>
          <SectionTitle action={t('tabs.timeline')} onAction={() => goTab('timeline')}>
            {t('trip.upcoming')}
          </SectionTitle>
          <View style={styles.blockBody}>
            <Card onPress={() => goTab('timeline')}>
              <View style={styles.eventRow}>
                <Squircle
                  width={44}
                  height={44}
                  radius={theme.radius.md}
                  borderWidth={0}
                  color={withAlpha(theme.colors.primary, 0.12)}
                  style={styles.eventIcon}
                >
                  <Ionicons name="calendar" size={22} color={theme.colors.primary} />
                </Squircle>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {nextEvent.title}
                  </Text>
                  {nextEvent.notes ? (
                    <Text style={styles.eventNotes} numberOfLines={1}>
                      {nextEvent.notes}
                    </Text>
                  ) : null}
                </View>
                <Badge label={formatCountdown(nextStatus)} tone="primary" icon="time-outline" />
              </View>
            </Card>
          </View>
        </View>
      ) : null}

      {/* Recent expenses */}
      {recent.length > 0 ? (
        <View>
          <SectionTitle action={t('trip.viewAll')} onAction={() => goTab('expenses')}>
            {t('trip.recent')}
          </SectionTitle>
          <View style={styles.recentBody}>
            {recent.map((expense, index) => (
              <Pressable
                key={expense.id}
                onPress={() =>
                  router.push({
                    pathname: '/trips/[id]/expenses/[expenseId]',
                    params: { id: tripId, expenseId: expense.id },
                  })
                }
                style={[styles.expenseRow, index === recent.length - 1 && styles.expenseRowLast]}
                accessibilityRole="button"
              >
                <Squircle
                  width={40}
                  height={40}
                  radius={theme.radius.md}
                  borderWidth={0}
                  color={withAlpha(theme.colors.muted, 0.12)}
                  style={styles.expenseIcon}
                >
                  <Ionicons
                    name={CATEGORY_ICON[expense.category as ExpenseCategory] ?? 'pricetag'}
                    size={19}
                    color={theme.colors.muted}
                  />
                </Squircle>
                <View style={styles.expenseInfo}>
                  <Text style={styles.expenseDescription} numberOfLines={1}>
                    {expense.description}
                  </Text>
                  <Text style={styles.expensePaidBy}>
                    {t('trip.paidBy', { name: payerName(expense.paid_by) })}
                  </Text>
                </View>
                <Text style={styles.expenseAmount}>
                  {formatAmount(expense.amount_cents, expense.currency)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.spacer} />
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  coverOverlay: {
    position: 'absolute',
    left: theme.gap(3.5),
    right: theme.gap(3.5),
    bottom: theme.gap(3),
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.gap(2.5),
  },
  coverInfo: {
    flexShrink: 1,
    gap: theme.gap(0.75),
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.25),
  },
  coverDestination: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  manage: {
    alignItems: 'center',
    gap: theme.gap(1),
  },
  manageLabel: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(3),
  },
  balanceInfo: {
    flexShrink: 1,
  },
  balanceLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  balanceAmount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xxl,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  balanceSub: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 3,
  },
  balanceIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  balanceButton: {
    marginTop: theme.gap(3.5),
  },
  quickActions: {
    flexDirection: 'row',
    gap: theme.gap(2.5),
  },
  blockBody: {
    marginTop: theme.gap(2.5),
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  eventIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  eventNotes: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 2,
  },
  recentBody: {
    marginTop: theme.gap(1),
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  expenseRowLast: {
    borderBottomWidth: 0,
  },
  expenseIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  expenseInfo: {
    flex: 1,
    minWidth: 0,
  },
  expenseDescription: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  expensePaidBy: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 3,
  },
  expenseAmount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  spacer: {
    height: FLOATING_TAB_BAR_CLEARANCE,
  },
}))
