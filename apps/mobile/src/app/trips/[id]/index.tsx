import { FlashList } from '@shopify/flash-list'
import { Link, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { useAuth } from '@/features/auth'
import { formatAmount, useExpenses, useTripBalances } from '@/features/expenses'
import { useTrip } from '@/features/trips'

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? ''
  const { data: trip, isLoading, isError } = useTrip(tripId)
  const { data: expenses } = useExpenses(tripId)
  const { data: balances } = useTripBalances(tripId)
  const { session } = useAuth()
  const userId = session?.user.id

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  if (isError || !trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtitle}>Trip not found.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={expenses ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text style={styles.title}>{trip.title}</Text>
            {trip.destination ? <Text style={styles.subtitle}>{trip.destination}</Text> : null}

            {balances && balances.length > 0 ? (
              <View style={styles.balances}>
                <Text style={styles.sectionTitle}>Balances</Text>
                {balances.map((balance) => (
                  <View key={balance.member_id} style={styles.balanceRow}>
                    <Text style={styles.expenseDesc}>
                      {balance.user_id === userId ? 'You' : 'Member'}
                    </Text>
                    <Text
                      style={[
                        styles.expenseAmount,
                        (balance.balance_cents ?? 0) < 0 ? styles.negative : null,
                      ]}
                    >
                      {formatAmount(balance.balance_cents ?? 0, trip.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Expenses</Text>
              <Link
                href={{ pathname: '/trips/[id]/add-expense', params: { id: tripId } }}
                style={styles.link}
              >
                Add
              </Link>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.muted}>No expenses yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.expenseRow}>
            <Text style={styles.expenseDesc}>{item.description}</Text>
            <Text style={styles.expenseAmount}>
              {formatAmount(item.amount_cents, item.currency)}
            </Text>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    paddingHorizontal: theme.gap(6),
    paddingTop: rt.insets.top + theme.gap(4),
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  head: {
    gap: theme.gap(1),
    paddingBottom: theme.gap(3),
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.gap(4),
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  balances: {
    gap: theme.gap(1),
    paddingTop: theme.gap(4),
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(1),
  },
  negative: {
    color: theme.colors.destructive,
  },
  muted: {
    color: theme.colors.muted,
    paddingTop: theme.gap(3),
  },
  list: {
    paddingBottom: rt.insets.bottom + theme.gap(4),
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  expenseDesc: {
    color: theme.colors.foreground,
  },
  expenseAmount: {
    color: theme.colors.foreground,
    fontWeight: '600',
  },
}))
