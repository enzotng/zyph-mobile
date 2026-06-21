import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { File, Paths } from 'expo-file-system'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native'
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TRIP_TAB_BAR_CLEARANCE } from '@/components/layout/trip-tab-bar'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Amount, Chip, EmptyState, ErrorState, Skeleton, Surface } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  CATEGORY_ICON,
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
  expensesToCsv,
  filterExpenses,
  formatAmount,
  useExpenses,
  useMyExpenseShares,
  useTripBalances,
} from '@/features/expenses'
import { memberLabel, useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

// Placeholder rows shown while the expense list loads, shaped to match the real content.
const SKELETON_ROWS = [0, 1, 2, 3, 4]

export default function TripExpensesScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user.id

  const { data: trip } = useTrip(tripId)
  const { data: expenses, isLoading, isError, refetch, isRefetching } = useExpenses(tripId)
  const { data: balances } = useTripBalances(tripId)
  const { data: members } = useTripMembers(tripId)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ExpenseCategory | null>(null)

  const filtered = useMemo(
    () => filterExpenses(expenses ?? [], { query, category }),
    [expenses, query, category],
  )
  const hasExpenses = (expenses ?? []).length > 0

  const myBalance = (balances ?? []).find((b) => b.user_id === userId)?.balance_cents ?? 0
  const settled = myBalance === 0
  const positive = myBalance > 0
  const balanceLabel = settled ? t('trip.settled') : positive ? t('trip.owed') : t('trip.owe')
  const balanceColor = settled
    ? theme.colors.foreground
    : positive
      ? theme.colors.success
      : theme.colors.destructive

  const labelByMemberId = useMemo(() => {
    const labels = { you: t('common.you'), fallback: t('common.member') }
    const map = new Map<string, string>()
    for (const member of members ?? []) {
      map.set(member.id, memberLabel(member, userId, labels))
    }
    return map
  }, [members, userId, t])

  const myMemberId = useMemo(
    () => (members ?? []).find((m) => m.user_id === userId)?.id ?? null,
    [members, userId],
  )
  const { data: myShares } = useMyExpenseShares(tripId, myMemberId)
  const shareByExpenseId = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of myShares ?? []) {
      map.set(s.expense_id, s.share_cents)
    }
    return map
  }, [myShares])
  const tripCurrency = trip?.currency ?? 'EUR'

  const payerName = useCallback(
    (memberId: string | null): string =>
      (memberId ? labelByMemberId.get(memberId) : undefined) ?? t('common.member'),
    [labelByMemberId, t],
  )

  function goAdd() {
    router.push({ pathname: '/trips/[id]/add-expense', params: { id: tripId } })
  }

  // Write the expense list to a CSV in the cache dir and hand it to the native share sheet
  // (save to Files, email, AirDrop on iOS). Android shares the CSV text as a fallback.
  const onExport = useCallback(async () => {
    if (!expenses?.length) {
      return
    }
    try {
      const csv = expensesToCsv(expenses, {
        labels: {
          date: t('expenses.csv.date'),
          description: t('expenses.csv.description'),
          category: t('expenses.csv.category'),
          amount: t('expenses.csv.amount'),
          currency: t('expenses.csv.currency'),
          tripAmount: t('expenses.csv.tripAmount', { currency: tripCurrency }),
          paidBy: t('expenses.csv.paidBy'),
        },
        categoryLabel: (c) => (c ? t(`categories.${c as ExpenseCategory}`) : ''),
        payerName,
      })
      if (Platform.OS === 'ios') {
        // Write to a cache file and share it (Files / email / AirDrop). The leading BOM makes
        // Excel on Windows read it as UTF-8 so accented headers and descriptions are not mangled.
        const date = new Date().toISOString().slice(0, 10)
        const file = new File(Paths.cache, `zyph-expenses-${date}.csv`)
        file.create({ overwrite: true })
        file.write(`\uFEFF${csv}`)
        await Share.share({ url: file.uri })
      } else {
        // Android's RN share takes text, not a file URL, so share the CSV inline.
        await Share.share({ message: csv })
      }
    } catch (error) {
      Alert.alert(
        t('expenses.exportError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }, [expenses, t, tripCurrency, payerName])

  const renderItem = useCallback(
    ({ item }: { item: Expense }) => {
      const myShare = shareByExpenseId.get(item.id)
      return (
        <Animated.View layout={LinearTransition}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              haptics.light()
              router.push({
                pathname: '/trips/[id]/expenses/[expenseId]',
                params: { id: tripId, expenseId: item.id },
              })
            }}
            accessibilityRole="button"
            accessibilityLabel={`${item.description}, ${formatAmount(item.amount_cents, item.currency)}`}
          >
            <Surface
              width={40}
              height={40}
              radius={theme.radius.md}
              borderWidth={0}
              color={withAlpha(theme.colors.muted, 0.12)}
              style={styles.rowTile}
            >
              <Ionicons
                name={CATEGORY_ICON[item.category as ExpenseCategory] ?? 'pricetag'}
                size={19}
                color={theme.colors.muted}
              />
            </Surface>
            <View style={styles.rowInfo}>
              <Text style={styles.rowDescription} numberOfLines={1}>
                {item.description}
              </Text>
              <Text style={styles.rowPaidBy}>
                {t('trip.paidBy', { name: payerName(item.paid_by) })}
              </Text>
            </View>
            <View style={styles.rowAmountCol}>
              <Amount cents={item.amount_cents} currency={item.currency} size={16} neutral />
              {myShare !== undefined ? (
                <Text style={styles.rowShare}>
                  {t('trip.yourShare', { amount: formatAmount(myShare, tripCurrency) })}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      )
    },
    [router, tripId, theme, t, payerName, shareByExpenseId, tripCurrency],
  )

  return (
    <Screen
      title={t('tabs.expenses')}
      showBack
      right={
        <View style={styles.headerActions}>
          {hasExpenses ? (
            <Pressable
              onPress={() => {
                haptics.light()
                void onExport()
              }}
              accessibilityRole="button"
              accessibilityLabel={t('expenses.export')}
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Ionicons name="share-outline" size={22} color={theme.colors.foreground} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              haptics.light()
              goAdd()
            }}
            accessibilityRole="button"
            accessibilityLabel={t('trip.newExpense')}
            hitSlop={8}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Ionicons name="add" size={26} color={theme.colors.primary} />
          </Pressable>
        </View>
      }
    >
      {isLoading ? (
        <ExpensesSkeleton />
      ) : isError ? (
        <ErrorState
          title={t('errors.title')}
          body={t('errors.body')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      ) : !hasExpenses ? (
        <EmptyState
          icon="card-outline"
          title={t('trip.noExpenses')}
          body={t('trip.noExpensesBody')}
          cta={t('trip.newExpense')}
          onCta={goAdd}
        />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          ListHeaderComponent={
            <View style={styles.header}>
              <Animated.View entering={FadeInDown.duration(320).springify()}>
                <Pressable
                  onPress={() => {
                    haptics.light()
                    router.push({ pathname: '/trips/[id]/balances', params: { id: tripId } })
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('trip.viewBalances')}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Surface
                    color={theme.colors.card}
                    borderColor={theme.colors.border}
                    borderWidth={1}
                    radius={theme.radius.lg}
                    style={styles.strip}
                  >
                    <View style={styles.stripLeft}>
                      <Surface
                        width={36}
                        height={36}
                        radius={theme.radius.md}
                        borderWidth={0}
                        color={withAlpha(theme.colors.primary, 0.12)}
                        style={styles.stripTile}
                      >
                        <Ionicons
                          name="git-compare-outline"
                          size={19}
                          color={theme.colors.primary}
                        />
                      </Surface>
                      <View>
                        <Text style={styles.stripLabel}>{balanceLabel}</Text>
                        <Text style={[styles.stripAmount, { color: balanceColor }]}>
                          {formatAmount(Math.abs(myBalance), trip?.currency ?? 'EUR')}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.stripRight}>
                      <Text style={styles.settleUp}>{t('expenses.settleUp')}</Text>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
                    </View>
                  </Surface>
                </Pressable>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(60).duration(320)}
                style={styles.headerControls}
              >
                <TextField
                  placeholder={t('trip.searchExpenses')}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                >
                  <Chip
                    label={t('trip.all')}
                    selected={category === null}
                    onPress={() => setCategory(null)}
                  />
                  {EXPENSE_CATEGORIES.map((key) => (
                    <Chip
                      key={key}
                      label={t(`categories.${key}`)}
                      icon={CATEGORY_ICON[key]}
                      selected={category === key}
                      onPress={() => setCategory(key)}
                    />
                  ))}
                </ScrollView>
              </Animated.View>
            </View>
          }
          ListEmptyComponent={<Text style={styles.noResults}>{t('trip.noResults')}</Text>}
          renderItem={renderItem}
        />
      )}
    </Screen>
  )
}

// Loading placeholder shaped like the expenses content: the balance strip, the search field,
// then a short list of expense rows.
function ExpensesSkeleton() {
  const { theme } = useUnistyles()
  return (
    <View style={styles.skeleton}>
      <Skeleton width="100%" height={72} radius={theme.radius.lg} />
      <Skeleton width="100%" height={48} radius={theme.radius.md} />
      <View style={styles.skeletonRows}>
        {SKELETON_ROWS.map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width={40} height={40} radius={theme.radius.md} />
            <View style={styles.skeletonRowInfo}>
              <Skeleton width="60%" height={15} radius={theme.radius.sm} />
              <Skeleton width="35%" height={12} radius={theme.radius.sm} />
            </View>
            <Skeleton width={56} height={16} radius={theme.radius.sm} />
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  list: {
    paddingBottom: rt.insets.bottom + TRIP_TAB_BAR_CLEARANCE,
  },
  header: {
    gap: theme.gap(3),
    paddingBottom: theme.gap(2),
  },
  headerControls: {
    gap: theme.gap(3),
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(3.5),
  },
  stripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
  },
  stripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
  },
  settleUp: {
    fontFamily: theme.fonts.sans.semibold,
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
  stripTile: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  stripLabel: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  stripAmount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
    marginTop: 1,
  },
  chips: {
    gap: theme.gap(2),
    paddingVertical: theme.gap(0.5),
  },
  noResults: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingVertical: theme.gap(8),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  rowTile: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowDescription: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  rowPaidBy: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: 3,
  },
  rowAmountCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rowShare: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  skeleton: {
    paddingTop: theme.gap(1),
    gap: theme.gap(3),
  },
  skeletonRows: {
    gap: theme.gap(4),
    paddingTop: theme.gap(2),
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  skeletonRowInfo: {
    flex: 1,
    gap: theme.gap(1.5),
  },
}))
