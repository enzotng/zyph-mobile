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
import { Amount, Chip, EmptyState, ErrorState, Eyebrow, Skeleton, Surface } from '@/components/ui'
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

// Text on the ink bezel stays light in both themes, so the "Your balance" card uses fixed
// cream constants (mirrors RightNowCard) rather than theme tokens. Money tones stay token-driven.
const CREAM = '#F4F1E8'
const CREAM_MUTED = 'rgba(244, 241, 232, 0.62)'
// Money tones that read on the ink bezel (the lighter dark-theme variants), used in both themes
// for the "Your balance" amount + Settle button - the light theme tokens are too dark on ink.
const BEZEL_POSITIVE = '#5FB98C'
const BEZEL_NEGATIVE = '#E2674A'

// Placeholder rows shown while the expense list loads, shaped to match the real content.
const SKELETON_ROWS = [0, 1, 2, 3, 4]

// Feed item: a day header or an expense row, ready for a single FlashList. Mirrors the timeline's
// groupEventsByDay shape so day grouping reads the same across screens.
type FeedItem =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'row'; key: string; expense: Expense }

// Local-timezone day key (YYYY-MM-DD) so grouping matches the displayed label.
function localDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

// Flattens the (already date-descending) expenses into [header, ...rows] sections by day.
// The day label is "Today" / "Yesterday" for the two most recent days, otherwise a short date.
function groupExpensesByDay(
  expenses: Expense[],
  labels: { today: string; yesterday: string },
): FeedItem[] {
  const items: FeedItem[] = []
  const todayKey = localDayKey(new Date().toISOString())
  const yesterdayKey = localDayKey(new Date(Date.now() - 86_400_000).toISOString())
  let lastDay: string | null = null

  for (const expense of expenses) {
    const day = localDayKey(expense.created_at)
    if (day !== lastDay) {
      const label =
        day === todayKey
          ? labels.today
          : day === yesterdayKey
            ? labels.yesterday
            : new Date(expense.created_at).toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })
      items.push({ kind: 'header', key: `header-${day}`, label })
      lastDay = day
    }
    items.push({ kind: 'row', key: expense.id, expense })
  }

  return items
}

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
  // The bezel is ink in both themes, so the amount uses the bezel-legible money tones (cream when
  // settled), not the light theme tokens which would be too dark on ink.
  const balanceColor = settled ? CREAM : positive ? BEZEL_POSITIVE : BEZEL_NEGATIVE

  const labelByMemberId = useMemo(() => {
    const labels = { you: t('common.you'), fallback: t('common.member') }
    const map = new Map<string, string>()
    for (const member of members ?? []) {
      map.set(member.id, memberLabel(member, userId, labels))
    }
    return map
  }, [members, userId, t])

  // Short sub-line under the net: when owed, name the people who owe (members in the red); when in
  // debt, a calm nudge; when settled, an all-clear. Uses balances + member labels already loaded.
  const balanceSub = useMemo(() => {
    if (settled) {
      return t('trip.settledSub')
    }
    if (!positive) {
      return t('trip.oweSub')
    }
    const debtorNames = (balances ?? [])
      .filter((b) => b.user_id !== userId && b.balance_cents < 0)
      .map((b) => labelByMemberId.get(b.member_id))
      .filter((name): name is string => Boolean(name))
    if (debtorNames.length === 0) {
      return t('trip.owedSubGeneric')
    }
    return t('trip.owedSub', { names: debtorNames.join(', ') })
  }, [settled, positive, balances, userId, labelByMemberId, t])

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

  // Group the filtered expenses into day-header + row sections for the FlashList.
  const feed = useMemo(
    () =>
      groupExpensesByDay(filtered, { today: t('common.today'), yesterday: t('common.yesterday') }),
    [filtered, t],
  )

  const payerName = useCallback(
    (memberId: string | null): string =>
      (memberId ? labelByMemberId.get(memberId) : undefined) ?? t('common.member'),
    [labelByMemberId, t],
  )

  function goAdd() {
    router.push({ pathname: '/trips/[id]/add-expense', params: { id: tripId } })
  }

  function goBalances() {
    router.push({ pathname: '/trips/[id]/balances', params: { id: tripId } })
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
    ({ item }: { item: FeedItem }) => {
      if (item.kind === 'header') {
        return <Eyebrow style={styles.dayHeader}>{item.label}</Eyebrow>
      }

      const expense = item.expense
      // Share-aware net for this row, all in trip currency: when the user paid, they are owed the
      // trip-currency total minus their own share; otherwise they owe their share. base_amount_cents
      // (the entry-time trip-currency conversion) keeps multi-currency nets in the trip currency;
      // amount_cents is the fallback when it is absent.
      const myShare = shareByExpenseId.get(expense.id) ?? 0
      const tripTotal = expense.base_amount_cents ?? expense.amount_cents
      const userPaid = expense.paid_by != null && expense.paid_by === myMemberId
      const netCents = tripTotal - myShare

      let shareLabel: string | null = null
      let shareColor: string = theme.colors.muted
      if (userPaid) {
        shareLabel = t('trip.youGet', { amount: formatAmount(netCents, tripCurrency) })
        shareColor = theme.colors.success
      } else if (myShare > 0) {
        shareLabel = t('trip.youOwe', { amount: formatAmount(myShare, tripCurrency) })
        shareColor = theme.colors.destructive
      }

      return (
        <Animated.View layout={LinearTransition}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              haptics.light()
              router.push({
                pathname: '/trips/[id]/expenses/[expenseId]',
                params: { id: tripId, expenseId: expense.id },
              })
            }}
            accessibilityRole="button"
            accessibilityLabel={`${expense.description}, ${formatAmount(expense.amount_cents, expense.currency)}`}
          >
            <Surface
              width={42}
              height={42}
              radius={theme.radius.md}
              borderWidth={0}
              color={withAlpha(theme.colors.primary, 0.1)}
              style={styles.rowTile}
            >
              <Ionicons
                name={CATEGORY_ICON[expense.category as ExpenseCategory] ?? 'pricetag'}
                size={19}
                color={theme.colors.primary}
              />
            </Surface>
            <View style={styles.rowInfo}>
              <Text style={styles.rowDescription} numberOfLines={1}>
                {expense.description}
              </Text>
              <Text style={styles.rowPaidBy} numberOfLines={1}>
                {t('trip.paidBy', { name: payerName(expense.paid_by) })}
              </Text>
            </View>
            <View style={styles.rowAmountCol}>
              <Amount cents={expense.amount_cents} currency={expense.currency} size={16} neutral />
              {shareLabel ? (
                <Text style={[styles.rowShare, { color: shareColor }]} numberOfLines={1}>
                  {shareLabel}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      )
    },
    [router, tripId, theme, t, payerName, shareByExpenseId, myMemberId, tripCurrency],
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
        <View style={styles.fill}>
          <FlashList
            data={feed}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.kind}
            contentContainerStyle={styles.list}
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.header}>
                <Animated.View entering={FadeInDown.duration(320)}>
                  <Pressable
                    onPress={() => {
                      haptics.light()
                      goBalances()
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('trip.viewBalances')}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <View style={styles.balanceCard}>
                      <Eyebrow style={styles.balanceLabel}>{t('trip.balanceLabel')}</Eyebrow>
                      <Text style={[styles.balanceAmount, { color: balanceColor }]}>
                        {formatAmount(Math.abs(myBalance), tripCurrency)}
                      </Text>
                      <Text style={styles.balanceSub} numberOfLines={1}>
                        {balanceSub}
                      </Text>
                      <View
                        style={styles.settleButton}
                        importantForAccessibility="no-hide-descendants"
                      >
                        <Ionicons name="git-compare-outline" size={16} color={theme.colors.bezel} />
                        <Text style={styles.settleButtonLabel}>{t('expenses.settleUp')}</Text>
                      </View>
                    </View>
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

          <Animated.View
            entering={FadeInDown.delay(120).duration(320)}
            style={styles.fab}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={() => {
                haptics.light()
                goAdd()
              }}
              accessibilityRole="button"
              accessibilityLabel={t('trip.newExpense')}
              style={({ pressed }) => [styles.fabButton, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={20} color={theme.colors.primaryForeground} />
              <Text style={styles.fabLabel}>{t('trip.expense')}</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </Screen>
  )
}

// Loading placeholder shaped like the expenses content: the balance card, the search field,
// then a short list of expense rows.
function ExpensesSkeleton() {
  const { theme } = useUnistyles()
  return (
    <View style={styles.skeleton}>
      <Skeleton width="100%" height={132} radius={theme.radius.lg} />
      <Skeleton width="100%" height={48} radius={theme.radius.md} />
      <View style={styles.skeletonRows}>
        {SKELETON_ROWS.map((i) => (
          <View key={i} style={styles.skeletonRow}>
            <Skeleton width={42} height={42} radius={theme.radius.md} />
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
  fill: {
    flex: 1,
  },
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
  // "Your balance" bezel card: ink in both themes, cream text, money-toned amount.
  balanceCard: {
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.bezel,
    paddingVertical: theme.gap(4),
    paddingHorizontal: theme.gap(4.5),
    gap: theme.gap(1),
  },
  balanceLabel: {
    color: CREAM_MUTED,
  },
  balanceAmount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: 28,
    letterSpacing: -0.5,
    marginTop: theme.gap(0.5),
  },
  balanceSub: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: CREAM_MUTED,
    marginTop: theme.gap(0.5),
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.gap(1.5),
    marginTop: theme.gap(2.5),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3.5),
    borderRadius: theme.radius.full,
    backgroundColor: BEZEL_POSITIVE,
  },
  settleButtonLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.bezel,
  },
  chips: {
    gap: theme.gap(2),
    paddingVertical: theme.gap(0.5),
  },
  dayHeader: {
    paddingTop: theme.gap(3),
    paddingBottom: theme.gap(1),
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
    width: 42,
    height: 42,
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
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.xs,
  },
  fab: {
    position: 'absolute',
    right: theme.gap(1),
    bottom: rt.insets.bottom + TRIP_TAB_BAR_CLEARANCE - theme.gap(6),
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryForeground,
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
