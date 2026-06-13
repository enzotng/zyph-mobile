import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { Avatar, Badge, Card, SectionTitle, Spinner, Surface } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  type ExpenseCategory,
  formatAmount,
  groupMembersByItemId,
  useDeleteExpense,
  useExpense,
  useExpenseItemAssignments,
  useExpenseItems,
  useExpenseSplits,
} from '@/features/expenses'
import { useTripMemberNames } from '@/features/group'
import { useTrip } from '@/features/trips'
import { withAlpha } from '@/lib/color'
import { formatRate } from '@/lib/money'
import { paramString } from '@/lib/routing'

const CATEGORY_ICON: Record<ExpenseCategory, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant',
  transport: 'car',
  lodging: 'bed',
  activity: 'ticket',
  shopping: 'bag-handle',
  other: 'pricetag',
}

export default function ExpenseDetailScreen() {
  const params = useGlobalSearchParams<{ id: string; expenseId: string }>()
  const tripId = paramString(params.id)
  const expenseId = paramString(params.expenseId)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user.id

  const { data: expense, isLoading } = useExpense(expenseId)
  const { data: splits } = useExpenseSplits(expenseId)
  const { data: items } = useExpenseItems(expenseId)
  const { data: itemAssignments } = useExpenseItemAssignments(expenseId)
  const { data: trip } = useTrip(tripId)
  const { data: members } = useTripMemberNames(tripId)
  const deleteExpense = useDeleteExpense(tripId)

  const hasItems = Boolean(items && items.length > 0)
  const membersByItemId = useMemo(
    () => groupMembersByItemId(itemAssignments ?? []),
    [itemAssignments],
  )

  const memberLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const member of members ?? []) {
      const label =
        member.user_id && member.user_id === userId
          ? t('common.you')
          : (member.display_name ?? t('common.member'))
      map.set(member.id, label)
    }
    return map
  }, [members, userId, t])

  function labelFor(memberId: string | null): string {
    if (!memberId) {
      return t('common.member')
    }
    return memberLabelById.get(memberId) ?? t('common.member')
  }

  function confirmDelete() {
    Alert.alert(t('expenseDetail.deleteTitle'), t('expenseDetail.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense.mutateAsync(expenseId)
            router.back()
          } catch (error) {
            Alert.alert(
              t('expenseDetail.deleteError'),
              error instanceof Error ? error.message : t('common.tryAgain'),
            )
          }
        },
      },
    ])
  }

  if (isLoading || !expense || !trip) {
    return (
      <Screen title={t('trip.expense')} showBack>
        <View style={styles.center}>
          <Spinner label={t('common.loading')} />
        </View>
      </Screen>
    )
  }

  const category = (expense.category as ExpenseCategory | null) ?? null
  const isForeign = expense.currency !== trip.currency
  const dateLabel = new Date(expense.created_at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
  })

  return (
    <Screen
      title={t('trip.expense')}
      showBack
      scroll
      right={
        <Pressable
          onPress={confirmDelete}
          disabled={deleteExpense.isPending}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={22} color={theme.colors.destructive} />
        </Pressable>
      }
    >
      <Card>
        <View style={styles.headRow}>
          <Surface
            width={46}
            height={46}
            radius={theme.radius.md}
            borderWidth={0}
            color={withAlpha(theme.colors.primary, 0.12)}
            style={styles.headTile}
          >
            <Ionicons
              name={category ? CATEGORY_ICON[category] : 'pricetag'}
              size={23}
              color={theme.colors.primary}
            />
          </Surface>
          <View style={styles.headInfo}>
            <Text style={styles.description} numberOfLines={2}>
              {expense.description}
            </Text>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <View style={styles.amountLeft}>
            <Text style={styles.paidBy}>
              {t('trip.paidBy', { name: labelFor(expense.paid_by) })}
            </Text>
            {category ? (
              <View style={styles.badgeWrap}>
                <Badge
                  label={t(`categories.${category}`)}
                  tone="muted"
                  icon={CATEGORY_ICON[category]}
                />
              </View>
            ) : null}
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amount}>
              {formatAmount(expense.amount_cents, expense.currency)}
            </Text>
            {isForeign ? (
              <Text style={styles.approx}>
                ≈ {formatAmount(expense.base_amount_cents, trip.currency)}
              </Text>
            ) : null}
          </View>
        </View>

        {isForeign ? (
          <View style={styles.fxRow}>
            <Ionicons name="lock-closed-outline" size={13} color={theme.colors.muted} />
            <Text style={styles.fxText}>
              {t('expenseDetail.rateLocked')} ·{' '}
              {formatRate(expense.fx_rate, expense.currency, trip.currency)}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardButton}>
          {hasItems ? (
            <Button
              label={t('trip.editSplit')}
              variant="secondary"
              icon="sparkles"
              onPress={() =>
                router.push({
                  pathname: '/trips/[id]/attribute-expense',
                  params: { id: tripId, expenseId },
                })
              }
            />
          ) : (
            <Button
              label={t('trip.edit')}
              variant="secondary"
              icon="create-outline"
              onPress={() =>
                router.push({
                  pathname: '/trips/[id]/expenses/[expenseId]/edit',
                  params: { id: tripId, expenseId },
                })
              }
            />
          )}
        </View>
      </Card>

      {hasItems ? (
        <View>
          <SectionTitle>{t('trip.items')}</SectionTitle>
          <View style={styles.sectionBody}>
            {(items ?? []).map((item, index) => {
              const names = (membersByItemId.get(item.id) ?? []).map(labelFor).join(' · ')
              return (
                <View
                  key={item.id}
                  style={[styles.itemRow, index === (items ?? []).length - 1 && styles.lastRow]}
                >
                  <View style={styles.itemTop}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <Text style={styles.itemAmount}>
                      {formatAmount(item.amount_cents, expense.currency)}
                    </Text>
                  </View>
                  <Text style={styles.itemWho}>
                    {names.length > 0 ? names : t('trip.unassigned')}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      ) : null}

      <View>
        <SectionTitle>{t('trip.split')}</SectionTitle>
        <View style={styles.sectionBody}>
          {(splits ?? []).map((split, index) => (
            <View
              key={split.id}
              style={[styles.splitRow, index === (splits ?? []).length - 1 && styles.lastRow]}
            >
              <View style={styles.splitLeft}>
                <Avatar name={labelFor(split.member_id)} size={28} />
                <Text style={styles.splitName}>{labelFor(split.member_id)}</Text>
              </View>
              <Text style={styles.splitAmount}>
                {formatAmount(split.share_cents, trip.currency)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  headTile: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
  },
  headInfo: {
    flex: 1,
    minWidth: 0,
  },
  description: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  date: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.gap(3),
    marginTop: theme.gap(3.5),
  },
  amountLeft: {
    flexShrink: 1,
  },
  paidBy: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
    marginTop: theme.gap(1.5),
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xl,
    letterSpacing: -0.5,
    color: theme.colors.foreground,
  },
  approx: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 2,
  },
  fxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
    marginTop: theme.gap(2.5),
  },
  fxText: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  cardButton: {
    marginTop: theme.gap(3),
  },
  sectionBody: {
    marginTop: theme.gap(1),
  },
  itemRow: {
    paddingVertical: theme.gap(2.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.gap(2.5),
  },
  itemLabel: {
    flex: 1,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  itemAmount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  itemWho: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 3,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(2.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  splitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
  },
  splitName: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  splitAmount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
}))
