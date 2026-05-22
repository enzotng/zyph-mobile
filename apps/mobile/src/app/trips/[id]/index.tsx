import { FlashList } from '@shopify/flash-list'
import { Link, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Pressable, Share, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { useAuth } from '@/features/auth'
import { formatAmount, useExpenses, useTripBalances } from '@/features/expenses'
import { useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? ''
  const { data: trip, isLoading, isError } = useTrip(tripId)
  const { data: expenses } = useExpenses(tripId)
  const { data: balances } = useTripBalances(tripId)
  const { data: members } = useTripMembers(tripId)
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

  const nameById = new Map((members ?? []).map((member) => [member.id, member.display_name]))

  function labelFor(memberUserId: string | null, memberId: string): string {
    if (memberUserId && memberUserId === userId) {
      return 'You'
    }
    return nameById.get(memberId) ?? 'Member'
  }

  async function shareInvite() {
    if (!trip) {
      return
    }
    await Share.share({
      message: `Join my trip "${trip.title}" on ZYPH with invite code: ${trip.invite_code}`,
    })
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

            <View style={styles.inviteRow}>
              <View>
                <Text style={styles.muted}>Invite code</Text>
                <Text style={styles.code}>{trip.invite_code}</Text>
              </View>
              <Pressable onPress={() => void shareInvite()} accessibilityRole="button">
                <Text style={styles.link}>Share</Text>
              </Pressable>
            </View>

            <Link
              href={{ pathname: '/trips/[id]/timeline', params: { id: tripId } }}
              style={styles.timelineLink}
            >
              View timeline →
            </Link>

            {members && members.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Members</Text>
                {members.map((member) => (
                  <View key={member.id} style={styles.rowBetween}>
                    <Text style={styles.body}>
                      {member.user_id === userId ? 'You' : (member.display_name ?? 'Member')}
                    </Text>
                    <Text style={styles.muted}>{member.role}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {balances && balances.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Balances</Text>
                {balances.map((balance) => (
                  <View key={balance.member_id} style={styles.rowBetween}>
                    <Text style={styles.body}>{labelFor(balance.user_id, balance.member_id)}</Text>
                    <Text
                      style={[
                        styles.amount,
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
            <Text style={styles.body}>{item.description}</Text>
            <Text style={styles.amount}>{formatAmount(item.amount_cents, item.currency)}</Text>
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
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
    marginTop: theme.gap(3),
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
  },
  code: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  section: {
    gap: theme.gap(1),
    paddingTop: theme.gap(4),
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
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(1),
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  timelineLink: {
    color: theme.colors.primary,
    fontWeight: '600',
    paddingTop: theme.gap(3),
  },
  muted: {
    color: theme.colors.muted,
  },
  body: {
    color: theme.colors.foreground,
  },
  amount: {
    color: theme.colors.foreground,
    fontWeight: '600',
  },
  negative: {
    color: theme.colors.destructive,
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
}))
