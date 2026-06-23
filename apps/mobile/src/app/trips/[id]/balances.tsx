import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Share, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import {
  Amount,
  Avatar,
  BottomSheet,
  EmptyState,
  ErrorState,
  Eyebrow,
  Spinner,
  Surface,
} from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  formatSettleUpSummary,
  type Settlement,
  settleBalances,
  toCents,
  useTripBalances,
} from '@/features/expenses'
import { useTripMemberNames } from '@/features/group'
import {
  type TripSettlement,
  useRecordSettlement,
  useReverseSettlement,
  useSettlements,
} from '@/features/settlements'
import { useTrip } from '@/features/trips'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { formatAmount } from '@/lib/money'
import { paramString } from '@/lib/routing'

const AMOUNT_RE = /^\d+([.,]\d{1,2})?$/

export default function TripBalancesScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const { session } = useAuth()
  const userId = session?.user.id

  const { data: trip, isLoading: tripLoading, isError: tripError } = useTrip(tripId)
  const {
    data: balances,
    isLoading: balancesLoading,
    isError: balancesError,
    refetch: refetchBalances,
  } = useTripBalances(tripId)
  const { data: members } = useTripMemberNames(tripId)
  const { data: paymentHistory, isLoading: historyLoading } = useSettlements(tripId)
  const recordSettlement = useRecordSettlement(tripId)
  const reverseSettlementMutation = useReverseSettlement(tripId)

  const [pendingSettlement, setPendingSettlement] = useState<Settlement | null>(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [settlingAll, setSettlingAll] = useState(false)

  const nameById = useMemo(
    () => new Map((members ?? []).map((member) => [member.id, member.display_name])),
    [members],
  )
  const userIdByMember = useMemo(
    () => new Map((balances ?? []).map((balance) => [balance.member_id, balance.user_id])),
    [balances],
  )
  const labelFor = useCallback(
    (memberUserId: string | null, memberId: string): string => {
      if (memberUserId && memberUserId === userId) {
        return t('common.you')
      }
      return nameById.get(memberId) ?? t('common.member')
    },
    [nameById, userId, t],
  )
  const labelForMember = useCallback(
    (memberId: string): string => labelFor(userIdByMember.get(memberId) ?? null, memberId),
    [labelFor, userIdByMember],
  )
  const isMeMember = useCallback(
    (memberId: string): boolean => {
      const memberUserId = userIdByMember.get(memberId) ?? null
      return memberUserId != null && memberUserId === userId
    },
    [userIdByMember, userId],
  )

  const settlements = useMemo(
    () =>
      settleBalances(
        (balances ?? []).map((balance) => ({
          memberId: balance.member_id,
          balanceCents: balance.balance_cents ?? 0,
        })),
      ),
    [balances],
  )
  // A shared summary must use real names, never "You" - the recipient would not know who that is.
  const shareNameFor = useCallback(
    (memberId: string): string => nameById.get(memberId) ?? t('common.member'),
    [nameById, t],
  )
  const myMemberId = useMemo(
    () => (balances ?? []).find((b) => b.user_id === userId)?.member_id ?? null,
    [balances, userId],
  )
  const myDebts = useMemo(
    () => settlements.filter((s) => s.fromMemberId === myMemberId),
    [settlements, myMemberId],
  )
  const myDebtsTotal = useMemo(() => myDebts.reduce((acc, s) => acc + s.amountCents, 0), [myDebts])

  async function onShare() {
    if (!trip) {
      return
    }
    const lines = settlements.map((s) => ({
      from: shareNameFor(s.fromMemberId),
      to: shareNameFor(s.toMemberId),
      amountCents: s.amountCents,
    }))
    await Share.share({
      message: formatSettleUpSummary({
        title: t('balances.shareTitle', { trip: trip.title }),
        lines,
        currency: trip.currency,
        settledLabel: t('group.allUpToDate'),
      }),
    })
  }

  function confirmSettleAll() {
    if (!trip || myDebts.length === 0) {
      return
    }
    Alert.alert(
      t('balances.settleAllTitle'),
      t('balances.settleAllBody', { amount: formatAmount(myDebtsTotal, trip.currency) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('balances.settleAllConfirm'), onPress: () => void settleAllMyDebts() },
      ],
    )
  }

  async function settleAllMyDebts() {
    if (myDebts.length === 0) {
      return
    }
    setSettlingAll(true)
    // record_settlement is one transfer per call and each commits independently, so on a mid-loop
    // failure we report how many already went through (every one is reversible from the history).
    let done = 0
    try {
      for (const debt of myDebts) {
        await recordSettlement.mutateAsync({
          tripId,
          fromMemberId: debt.fromMemberId,
          toMemberId: debt.toMemberId,
          amountCents: debt.amountCents,
        })
        done += 1
      }
      haptics.success()
    } catch (error) {
      Alert.alert(
        t('group.paymentFailedTitle'),
        done > 0
          ? t('balances.settleAllPartial', { done, total: myDebts.length })
          : error instanceof Error
            ? error.message
            : t('common.tryAgain'),
      )
    } finally {
      setSettlingAll(false)
    }
  }

  function openSettle(settlement: Settlement) {
    setPendingSettlement(settlement)
    setSettleAmount((settlement.amountCents / 100).toFixed(2))
  }

  async function confirmSettle() {
    if (!pendingSettlement || !trip || !AMOUNT_RE.test(settleAmount.trim())) {
      return
    }
    const amountCents = toCents(settleAmount)
    if (amountCents <= 0) {
      return
    }
    try {
      await recordSettlement.mutateAsync({
        tripId,
        fromMemberId: pendingSettlement.fromMemberId,
        toMemberId: pendingSettlement.toMemberId,
        amountCents,
      })
      haptics.success()
      setPendingSettlement(null)
    } catch (error) {
      Alert.alert(
        t('group.paymentFailedTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  function confirmUndo(settlement: TripSettlement) {
    haptics.warning()
    Alert.alert(t('group.confirmUndoTitle'), t('group.confirmUndoBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('group.undo'),
        style: 'destructive',
        onPress: async () => {
          try {
            await reverseSettlementMutation.mutateAsync(settlement.id)
            haptics.success()
          } catch (error) {
            Alert.alert(
              t('group.undoFailedTitle'),
              error instanceof Error ? error.message : t('common.tryAgain'),
            )
          }
        },
      },
    ])
  }

  // A settlement card label: "X pays you" when the current user is the receiver, else "X pays Y".
  const settleLabel = useCallback(
    (settlement: Settlement): string => {
      const from = labelForMember(settlement.fromMemberId)
      if (isMeMember(settlement.toMemberId)) {
        return t('balances.paysYou', { from })
      }
      return t('balances.paysPerson', { from, to: labelForMember(settlement.toMemberId) })
    },
    [labelForMember, isMeMember, t],
  )

  if (tripLoading || balancesLoading || historyLoading) {
    return (
      <Screen title={t('balances.title')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (tripError || balancesError || !trip) {
    return (
      <Screen title={t('balances.title')} showBack>
        <View style={styles.center}>
          <ErrorState
            title={t('balances.errorTitle')}
            body={t('balances.errorBody')}
            retryLabel={t('common.tryAgain')}
            onRetry={() => void refetchBalances()}
          />
        </View>
      </Screen>
    )
  }

  const hasExpenses = (balances ?? []).some(
    (b) => (b.paid_cents ?? 0) !== 0 || (b.owed_cents ?? 0) !== 0,
  )
  const hasHistory = paymentHistory != null && paymentHistory.length > 0

  if (!hasExpenses && !hasHistory) {
    return (
      <Screen title={t('balances.title')} showBack>
        <View style={styles.center}>
          <EmptyState
            icon="scale-outline"
            title={t('balances.emptyTitle')}
            body={t('balances.emptyBody')}
          />
        </View>
      </Screen>
    )
  }

  const hasSettlements = settlements.length > 0
  const canSettleAll = myDebts.length > 0

  return (
    <Screen
      title={t('balances.title')}
      showBack
      scroll
      right={
        <Pressable
          onPress={() => void onShare()}
          accessibilityRole="button"
          accessibilityLabel={t('balances.share')}
          hitSlop={8}
        >
          <Ionicons name="share-outline" size={22} color={theme.colors.foreground} />
        </Pressable>
      }
    >
      {/* Who owes whom: the suggested settlement transfers, each tappable to record it */}
      <Animated.View entering={FadeInDown.duration(320)} style={styles.section}>
        <Eyebrow>{t('balances.whoOwesWhom')}</Eyebrow>
        {hasSettlements ? (
          <View style={styles.cardList}>
            {settlements.map((settlement) => (
              <Pressable
                key={`${settlement.fromMemberId}-${settlement.toMemberId}`}
                onPress={() => openSettle(settlement)}
                accessibilityRole="button"
                accessibilityLabel={settleLabel(settlement)}
                style={({ pressed }) => (pressed ? styles.pressed : undefined)}
              >
                <Surface radius={theme.radius.lg} style={styles.settleCard}>
                  <Avatar name={labelForMember(settlement.fromMemberId)} size={36} />
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.muted} />
                  <Avatar name={labelForMember(settlement.toMemberId)} size={36} />
                  <Text style={styles.settleLabel} numberOfLines={2}>
                    {settleLabel(settlement)}
                  </Text>
                  <Amount cents={settlement.amountCents} currency={trip.currency} size={16} />
                </Surface>
              </Pressable>
            ))}
          </View>
        ) : (
          <Surface
            radius={theme.radius.lg}
            borderWidth={0}
            color={withAlpha(theme.colors.success, 0.12)}
            style={styles.settledBanner}
          >
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
            <Text style={styles.settledText} numberOfLines={2}>
              {t('group.allUpToDate')}
            </Text>
          </Surface>
        )}
      </Animated.View>

      {/* Each person: the per-member net balance, signed and money-toned */}
      <Animated.View entering={FadeInDown.delay(60).duration(320)} style={styles.section}>
        <Eyebrow>{t('balances.eachPerson')}</Eyebrow>
        <Surface radius={theme.radius.lg} style={styles.personList}>
          {(balances ?? []).map((balance, index) => (
            <View
              key={balance.member_id}
              style={[
                styles.personRow,
                index === (balances ?? []).length - 1 && styles.personRowLast,
              ]}
            >
              <Avatar name={labelFor(balance.user_id, balance.member_id)} size={36} />
              <Text style={styles.personName} numberOfLines={1}>
                {labelFor(balance.user_id, balance.member_id)}
              </Text>
              <Amount
                cents={balance.balance_cents ?? 0}
                currency={trip.currency}
                size={16}
                signed
              />
            </View>
          ))}
        </Surface>
      </Animated.View>

      {/* Payment history: recorded settlements, each reversible */}
      {hasHistory ? (
        <Animated.View entering={FadeInDown.delay(120).duration(320)} style={styles.section}>
          <Eyebrow>{t('group.paymentHistory')}</Eyebrow>
          <Surface radius={theme.radius.lg} style={styles.personList}>
            {paymentHistory.map((settlement, index) => (
              <View
                key={settlement.id}
                style={[
                  styles.historyRow,
                  index === paymentHistory.length - 1 && styles.personRowLast,
                ]}
              >
                <View style={styles.historyInfo}>
                  <Text style={styles.historyParties} numberOfLines={1}>
                    <Text style={styles.settleName}>{labelForMember(settlement.from_member)}</Text>
                    {` ${t('group.paysTo')} `}
                    <Text style={styles.settleName}>{labelForMember(settlement.to_member)}</Text>
                  </Text>
                  <Text style={styles.historyDate}>
                    {new Date(settlement.paid_at).toLocaleDateString(i18n.language, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                </View>
                <Amount
                  cents={settlement.amount_cents}
                  currency={settlement.currency}
                  size={15}
                  neutral
                />
                <Pressable
                  onPress={() => confirmUndo(settlement)}
                  disabled={reverseSettlementMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={t('group.undo')}
                  hitSlop={6}
                  style={({ pressed }) => (pressed ? styles.pressed : undefined)}
                >
                  <Text style={styles.removeText}>{t('group.undo')}</Text>
                </Pressable>
              </View>
            ))}
          </Surface>
        </Animated.View>
      ) : null}

      {/* Mark as settled: records all my suggested payments at once */}
      {canSettleAll ? (
        <Animated.View entering={FadeInDown.delay(180).duration(320)}>
          <Pressable
            onPress={confirmSettleAll}
            disabled={settlingAll || recordSettlement.isPending}
            accessibilityRole="button"
            accessibilityLabel={
              settlingAll
                ? t('balances.settlingAll')
                : t('balances.settleAllMine', {
                    amount: formatAmount(myDebtsTotal, trip.currency),
                  })
            }
            accessibilityState={{ disabled: settlingAll || recordSettlement.isPending }}
            style={({ pressed }) => [
              styles.settleAll,
              pressed && styles.pressed,
              (settlingAll || recordSettlement.isPending) && styles.disabled,
            ]}
          >
            <Ionicons name="checkmark-done" size={18} color={theme.colors.primaryForeground} />
            <Text style={styles.settleAllLabel}>
              {settlingAll ? t('balances.settlingAll') : t('balances.markAsSettled')}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <BottomSheet
        open={pendingSettlement != null}
        onClose={() => setPendingSettlement(null)}
        title={t('group.confirmPaymentTitle')}
      >
        {pendingSettlement ? (
          <View style={styles.sheetBody}>
            <View style={styles.sheetParties}>
              <Avatar name={labelForMember(pendingSettlement.fromMemberId)} size={36} />
              <Ionicons name="arrow-forward" size={18} color={theme.colors.muted} />
              <Avatar name={labelForMember(pendingSettlement.toMemberId)} size={36} />
              <Text style={styles.sheetPartiesText} numberOfLines={2}>
                {settleLabel(pendingSettlement)}
              </Text>
            </View>
            <TextField
              label={t('expenseForm.amount', { currency: trip.currency })}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={settleAmount}
              onChangeText={setSettleAmount}
            />
            <Button
              label={
                recordSettlement.isPending ? t('group.recordingPayment') : t('group.confirmPayment')
              }
              onPress={() => void confirmSettle()}
              disabled={recordSettlement.isPending || !AMOUNT_RE.test(settleAmount.trim())}
            />
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: theme.gap(2.5),
  },
  cardList: {
    gap: theme.gap(2.5),
  },
  settleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(3.5),
  },
  settleLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
    paddingVertical: theme.gap(3.5),
    paddingHorizontal: theme.gap(4),
  },
  settledText: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  personList: {
    paddingHorizontal: theme.gap(3.5),
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  personRowLast: {
    borderBottomWidth: 0,
  },
  personName: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  historyInfo: {
    flex: 1,
    minWidth: 0,
    gap: theme.gap(0.5),
  },
  historyParties: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  settleName: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
  },
  historyDate: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  removeText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
  },
  settleAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(2),
    minHeight: 48,
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(6),
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.success,
  },
  settleAllLabel: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
    color: theme.colors.primaryForeground,
  },
  sheetBody: {
    gap: theme.gap(4),
  },
  sheetParties: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  sheetPartiesText: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
}))
