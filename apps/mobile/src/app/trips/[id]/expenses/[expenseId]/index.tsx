import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { useAuth } from '@/features/auth'
import { formatAmount, useDeleteExpense, useExpense, useExpenseSplits } from '@/features/expenses'
import { useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

export default function ExpenseDetailScreen() {
  const params = useLocalSearchParams<{ id: string; expenseId: string }>()
  const tripId = paramString(params.id)
  const expenseId = paramString(params.expenseId)
  const router = useRouter()
  const { session } = useAuth()
  const userId = session?.user.id

  const { data: expense, isLoading } = useExpense(expenseId)
  const { data: splits } = useExpenseSplits(expenseId)
  const { data: trip } = useTrip(tripId)
  const { data: members } = useTripMembers(tripId)
  const deleteExpense = useDeleteExpense(tripId)

  function labelFor(memberId: string | null): string {
    if (!memberId) {
      return 'Unknown'
    }
    const member = members?.find((m) => m.id === memberId)
    if (!member) {
      return 'Member'
    }
    if (member.user_id && member.user_id === userId) {
      return 'You'
    }
    return member.display_name ?? 'Member'
  }

  function confirmDelete() {
    Alert.alert('Delete expense', 'This permanently removes the expense from the trip.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpense.mutateAsync(expenseId)
            router.back()
          } catch (error) {
            Alert.alert(
              'Could not delete',
              error instanceof Error ? error.message : 'Please try again.',
            )
          }
        },
      },
    ])
  }

  if (isLoading || !expense || !trip) {
    return (
      <Screen showBack>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    )
  }

  const isForeign = expense.currency !== trip.currency

  return (
    <Screen title={expense.description} scroll>
      <View style={styles.card}>
        <Text style={styles.amount}>{formatAmount(expense.amount_cents, expense.currency)}</Text>
        {isForeign ? (
          <Text style={styles.muted}>
            ≈ {formatAmount(expense.base_amount_cents, trip.currency)} (rate{' '}
            {expense.fx_rate.toFixed(4)})
          </Text>
        ) : null}
        <Text style={styles.muted}>Paid by {labelFor(expense.paid_by)}</Text>
        <Text style={styles.muted}>{new Date(expense.created_at).toLocaleString()}</Text>
      </View>

      <View style={styles.actions}>
        <Link
          href={{
            pathname: '/trips/[id]/expenses/[expenseId]/edit',
            params: { id: tripId, expenseId },
          }}
          style={styles.link}
        >
          Edit
        </Link>
        <Pressable
          onPress={confirmDelete}
          disabled={deleteExpense.isPending}
          accessibilityRole="button"
        >
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Splits</Text>
      {!splits || splits.length === 0 ? (
        <Text style={styles.muted}>No splits.</Text>
      ) : (
        splits.map((split) => (
          <View key={split.id} style={styles.row}>
            <Text style={styles.body}>{labelFor(split.member_id)}</Text>
            <Text style={styles.amountValue}>{formatAmount(split.share_cents, trip.currency)}</Text>
          </View>
        ))
      )}
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    gap: theme.gap(1),
    padding: theme.gap(4),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  amount: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  amountValue: {
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  muted: {
    color: theme.colors.muted,
  },
  body: {
    color: theme.colors.foreground,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.foreground,
    paddingTop: theme.gap(2),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.gap(4),
    paddingTop: theme.gap(1),
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  deleteText: {
    color: theme.colors.destructive,
    fontWeight: '600',
  },
}))
