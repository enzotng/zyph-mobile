import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Chip, EmptyState, Skeleton, Surface } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
  filterExpenses,
  formatAmount,
  useExpenses,
  useTripBalances,
} from '@/features/expenses'
import { useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

const CATEGORY_ICON: Record<ExpenseCategory, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant',
  transport: 'car',
  lodging: 'bed',
  activity: 'ticket',
  shopping: 'bag-handle',
  other: 'pricetag',
}

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
  const { data: expenses, isLoading } = useExpenses(tripId)
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

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const member of members ?? []) {
      if (member.display_name) map.set(member.id, member.display_name)
    }
    return map
  }, [members])

  const payerName = useCallback(
    (memberId: string | null): string =>
      (memberId ? memberNameById.get(memberId) : undefined) ?? t('common.member'),
    [memberNameById, t],
  )

  function goAdd() {
    router.push({ pathname: '/trips/[id]/add-expense', params: { id: tripId } })
  }

  const renderItem = useCallback(
    ({ item }: { item: Expense }) => (
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
          <Text style={styles.rowAmount}>{formatAmount(item.amount_cents, item.currency)}</Text>
        </Pressable>
      </Animated.View>
    ),
    [router, tripId, theme, t, payerName],
  )

  return (
    <Screen
      title={t('tabs.expenses')}
      showBack
      right={
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
      }
    >
      {isLoading ? (
        <ExpensesSkeleton />
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
    paddingBottom: rt.insets.bottom + FLOATING_TAB_BAR_CLEARANCE,
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
  rowAmount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
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
