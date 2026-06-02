import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { CategoryPicker, categoryLabel } from '@/components/category-picker'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Squircle } from '@/components/ui'
import {
  type ExpenseCategory,
  filterExpenses,
  formatAmount,
  useExpenses,
} from '@/features/expenses'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

export default function TripExpensesScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { data: trip } = useTrip(tripId)
  const { data: expenses } = useExpenses(tripId)

  const [query, setQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | null>(null)

  const filteredExpenses = useMemo(
    () => filterExpenses(expenses ?? [], { query, category: filterCategory }),
    [expenses, query, filterCategory],
  )

  const hasExpenses = (expenses ?? []).length > 0
  const tripCurrency = trip?.currency

  return (
    <Screen
      title={trip?.title}
      showBack
      right={
        <Pressable
          onPress={() =>
            router.push({ pathname: '/trips/[id]/add-expense', params: { id: tripId } })
          }
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          hitSlop={8}
        >
          <Ionicons name="add" size={26} color={theme.colors.foreground} />
        </Pressable>
      }
    >
      <FlashList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          hasExpenses ? (
            <View style={styles.filters}>
              <TextField
                label="Search"
                placeholder="Search expenses"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <CategoryPicker value={filterCategory} onChange={setFilterCategory} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.muted}>
            {hasExpenses ? 'No expenses match the filter.' : 'No expenses yet.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.expenseRow}
            onPress={() =>
              router.push({
                pathname: '/trips/[id]/expenses/[expenseId]',
                params: { id: tripId, expenseId: item.id },
              })
            }
            accessibilityRole="button"
          >
            <View style={styles.expenseInfo}>
              <Text style={styles.body}>{item.description}</Text>
              {item.category ? (
                <Squircle
                  color={theme.colors.card}
                  borderColor={theme.colors.border}
                  borderWidth={1}
                  radius={theme.radius.sm}
                  style={styles.categoryBadge}
                >
                  <Text style={styles.categoryBadgeText}>
                    {categoryLabel(item.category as ExpenseCategory)}
                  </Text>
                </Squircle>
              ) : null}
            </View>
            <View style={styles.amountCol}>
              <Text style={styles.amount}>{formatAmount(item.amount_cents, item.currency)}</Text>
              {tripCurrency && item.currency !== tripCurrency ? (
                <Text style={styles.muted}>
                  ≈ {formatAmount(item.base_amount_cents, tripCurrency)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  list: {
    paddingBottom: rt.insets.bottom + FLOATING_TAB_BAR_CLEARANCE,
  },
  filters: {
    gap: theme.gap(2),
    paddingBottom: theme.gap(3),
  },
  muted: {
    color: theme.colors.muted,
  },
  body: {
    color: theme.colors.foreground,
  },
  expenseInfo: {
    flex: 1,
    gap: theme.gap(1),
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.gap(2),
    paddingVertical: theme.gap(1),
  },
  categoryBadgeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  amount: {
    color: theme.colors.foreground,
    fontWeight: '600',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
}))
