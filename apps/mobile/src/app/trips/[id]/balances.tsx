import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import {
  Amount,
  Avatar,
  BottomSheet,
  Card,
  EmptyState,
  ErrorState,
  SectionTitle,
  Spinner,
  Surface,
} from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  pairwiseBalances,
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
  const [expanded, setExpanded] = useState<string | null>(null)

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
  const pairwise = useMemo(() => pairwiseBalances(settlements), [settlements])

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
      setPendingSettlement(null)
    } catch (error) {
      Alert.alert(
        t('group.paymentFailedTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  function confirmUndo(settlement: TripSettlement) {
    Alert.alert(t('group.confirmUndoTitle'), t('group.confirmUndoBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('group.undo'),
        style: 'destructive',
        onPress: async () => {
          try {
            await reverseSettlementMutation.mutateAsync(settlement.id)
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

  return (
    <Screen title={t('balances.title')} showBack scroll>
      {/* Suggested settlements */}
      <View>
        <SectionTitle>{t('group.suggestedSettlements')}</SectionTitle>
        <View style={styles.blockBody}>
          {hasSettlements ? (
            <View style={styles.settleList}>
              {settlements.map((settlement) => (
                <Card
                  key={`${settlement.fromMemberId}-${settlement.toMemberId}`}
                  padding={theme.gap(3)}
                >
                  <View style={styles.settleRow}>
                    <Avatar name={labelForMember(settlement.fromMemberId)} size={32} />
                    <Ionicons name="arrow-forward" size={16} color={theme.colors.muted} />
                    <Avatar name={labelForMember(settlement.toMemberId)} size={32} />
                    <Text style={styles.settleText} numberOfLines={2}>
                      <Text style={styles.settleName}>
                        {labelForMember(settlement.fromMemberId)}
                      </Text>
                      {` ${t('group.owesTo')} `}
                      <Text style={styles.settleName}>{labelForMember(settlement.toMemberId)}</Text>
                    </Text>
                    <Amount
                      cents={settlement.amountCents}
                      currency={trip.currency}
                      size={15}
                      neutral
                    />
                  </View>
                  <View style={styles.settleActions}>
                    <Button
                      label={t('group.markAsPaid')}
                      icon="checkmark-circle-outline"
                      variant="secondary"
                      size="sm"
                      block={false}
                      onPress={() => openSettle(settlement)}
                    />
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Surface
              borderWidth={0}
              radius={theme.radius.lg}
              color={withAlpha(theme.colors.success, 0.1)}
              style={styles.settledBanner}
            >
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
              <Text style={styles.settledText} numberOfLines={2}>
                {t('group.allUpToDate')}
              </Text>
            </Surface>
          )}
        </View>
      </View>

      {/* Per-member balances: paid / owed / net, tap to expand the pairwise breakdown */}
      <View>
        <SectionTitle>{t('group.balances')}</SectionTitle>
        <View style={styles.listBody}>
          {(balances ?? []).map((balance, index) => {
            const isOpen = expanded === balance.member_id
            const detail = pairwise.get(balance.member_id)
            return (
              <View
                key={balance.member_id}
                style={[
                  styles.balanceItem,
                  index === (balances ?? []).length - 1 && styles.balanceItemLast,
                ]}
              >
                <Pressable
                  style={styles.listRow}
                  onPress={() => setExpanded(isOpen ? null : balance.member_id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  accessibilityLabel={labelFor(balance.user_id, balance.member_id)}
                >
                  <View style={styles.rowMember}>
                    <Avatar name={labelFor(balance.user_id, balance.member_id)} size={30} />
                    <Text style={styles.memberName}>
                      {labelFor(balance.user_id, balance.member_id)}
                    </Text>
                  </View>
                  <Amount
                    cents={balance.balance_cents ?? 0}
                    currency={trip.currency}
                    size={15}
                    signed
                  />
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={theme.colors.muted}
                  />
                </Pressable>

                {isOpen ? (
                  <View style={styles.breakdown}>
                    <View style={styles.breakdownLine}>
                      <Text style={styles.breakdownLabel}>{t('balances.paid')}</Text>
                      <Amount
                        cents={balance.paid_cents ?? 0}
                        currency={trip.currency}
                        size={13}
                        neutral
                      />
                    </View>
                    <View style={styles.breakdownLine}>
                      <Text style={styles.breakdownLabel}>{t('balances.owed')}</Text>
                      <Amount
                        cents={balance.owed_cents ?? 0}
                        currency={trip.currency}
                        size={13}
                        neutral
                      />
                    </View>
                    {detail?.owes.map((entry) => (
                      <Text key={`owe-${entry.memberId}`} style={styles.pairLine} numberOfLines={1}>
                        {t('balances.pays', {
                          name: labelForMember(entry.memberId),
                          amount: formatAmount(entry.amountCents, trip.currency),
                        })}
                      </Text>
                    ))}
                    {detail?.owedBy.map((entry) => (
                      <Text
                        key={`owed-${entry.memberId}`}
                        style={styles.pairLine}
                        numberOfLines={1}
                      >
                        {t('balances.receives', {
                          name: labelForMember(entry.memberId),
                          amount: formatAmount(entry.amountCents, trip.currency),
                        })}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      </View>

      {/* Payment history */}
      {hasHistory ? (
        <View>
          <SectionTitle>{t('group.paymentHistory')}</SectionTitle>
          <View style={styles.listBody}>
            {paymentHistory.map((settlement, index) => (
              <View
                key={settlement.id}
                style={[
                  styles.listRow,
                  styles.historyRow,
                  index === paymentHistory.length - 1 && styles.listRowLast,
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
          </View>
        </View>
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
                <Text style={styles.settleName}>
                  {labelForMember(pendingSettlement.fromMemberId)}
                </Text>
                {` ${t('group.paysTo')} `}
                <Text style={styles.settleName}>
                  {labelForMember(pendingSettlement.toMemberId)}
                </Text>
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
  blockBody: {
    marginTop: theme.gap(2.5),
  },
  settleList: {
    gap: theme.gap(2.5),
  },
  settleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  settleText: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  settleName: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
    paddingVertical: theme.gap(3.5),
    paddingHorizontal: theme.gap(4),
  },
  settledText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  settleActions: {
    marginTop: theme.gap(2.5),
    alignItems: 'flex-end',
  },
  listBody: {
    marginTop: theme.gap(1),
  },
  balanceItem: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  balanceItemLast: {
    borderBottomWidth: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2.5),
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  historyRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  breakdown: {
    paddingLeft: theme.gap(10),
    paddingBottom: theme.gap(3),
    gap: theme.gap(1),
  },
  breakdownLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  pairLine: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
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
    opacity: 0.85,
  },
}))
