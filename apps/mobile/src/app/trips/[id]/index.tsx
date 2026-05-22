import { FlashList } from '@shopify/flash-list'
import * as Clipboard from 'expo-clipboard'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { useAuth } from '@/features/auth'
import { formatAmount, settleBalances, useExpenses, useTripBalances } from '@/features/expenses'
import { useRegenerateInviteCode, useTripMembers } from '@/features/group'
import { useDeleteTrip, useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { data: trip, isLoading, isError } = useTrip(tripId)
  const { data: expenses } = useExpenses(tripId)
  const { data: balances } = useTripBalances(tripId)
  const { data: members } = useTripMembers(tripId)
  const { session } = useAuth()
  const userId = session?.user.id
  const router = useRouter()
  const deleteTrip = useDeleteTrip()
  const regenerate = useRegenerateInviteCode(tripId)

  if (isLoading) {
    return (
      <Screen showBack>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    )
  }

  if (isError || !trip) {
    return (
      <Screen showBack>
        <View style={styles.center}>
          <Text style={styles.subtitle}>Trip not found.</Text>
        </View>
      </Screen>
    )
  }

  const nameById = new Map((members ?? []).map((member) => [member.id, member.display_name]))
  const userIdByMember = new Map(
    (balances ?? []).map((balance) => [balance.member_id, balance.user_id]),
  )

  function labelFor(memberUserId: string | null, memberId: string): string {
    if (memberUserId && memberUserId === userId) {
      return 'You'
    }
    return nameById.get(memberId) ?? 'Member'
  }

  function labelForMember(memberId: string): string {
    return labelFor(userIdByMember.get(memberId) ?? null, memberId)
  }

  const settlements = settleBalances(
    (balances ?? []).map((balance) => ({
      memberId: balance.member_id,
      balanceCents: balance.balance_cents ?? 0,
    })),
  )

  async function shareInvite() {
    if (!trip) {
      return
    }
    await Share.share({
      message: `Join my trip "${trip.title}" on ZYPH with invite code: ${trip.invite_code}`,
    })
  }

  async function copyInvite() {
    if (!trip) {
      return
    }
    await Clipboard.setStringAsync(trip.invite_code)
    Alert.alert('Copied', 'Invite code copied to clipboard.')
  }

  function confirmRegenerate() {
    Alert.alert(
      'Regenerate invite code',
      'The current code stops working. People who already joined keep their access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            try {
              await regenerate.mutateAsync()
            } catch (error) {
              Alert.alert(
                'Could not regenerate',
                error instanceof Error ? error.message : 'Please try again.',
              )
            }
          },
        },
      ],
    )
  }

  const isOwner = trip.owner_id === userId

  function confirmDelete() {
    Alert.alert('Delete trip', 'This permanently removes the trip and all its data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTrip.mutateAsync(tripId)
            router.replace('/')
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

  return (
    <Screen title={trip.title}>
      <FlashList
        data={expenses ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.head}>
            {trip.destination ? <Text style={styles.subtitle}>{trip.destination}</Text> : null}

            {isOwner ? (
              <View style={styles.ownerActions}>
                <Link
                  href={{ pathname: '/trips/[id]/edit', params: { id: tripId } }}
                  style={styles.link}
                >
                  Edit
                </Link>
                <Pressable
                  onPress={confirmDelete}
                  disabled={deleteTrip.isPending}
                  accessibilityRole="button"
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.inviteRow}>
              <View style={styles.inviteInfo}>
                <Text style={styles.muted}>Invite code</Text>
                <Text style={styles.code}>{trip.invite_code}</Text>
              </View>
              <View style={styles.inviteActions}>
                <Pressable onPress={() => void copyInvite()} accessibilityRole="button">
                  <Text style={styles.link}>Copy</Text>
                </Pressable>
                <Pressable onPress={() => void shareInvite()} accessibilityRole="button">
                  <Text style={styles.link}>Share</Text>
                </Pressable>
              </View>
            </View>

            {isOwner ? (
              <Pressable
                onPress={confirmRegenerate}
                disabled={regenerate.isPending}
                accessibilityRole="button"
                style={styles.regenerate}
              >
                <Text style={styles.muted}>
                  {regenerate.isPending ? 'Regenerating…' : 'Regenerate code'}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.navLinks}>
              <Link
                href={{ pathname: '/trips/[id]/timeline', params: { id: tripId } }}
                style={styles.timelineLink}
              >
                View timeline →
              </Link>
              <Link
                href={{ pathname: '/trips/[id]/map', params: { id: tripId } }}
                style={styles.timelineLink}
              >
                View map →
              </Link>
            </View>

            {members && members.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Members ({members.length})</Text>
                {members.map((member) => {
                  const name = member.user_id === userId ? 'You' : (member.display_name ?? 'Member')
                  const initial = name.charAt(0).toUpperCase()
                  return (
                    <View key={member.id} style={styles.memberRow}>
                      <View style={styles.memberInfo}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{initial}</Text>
                        </View>
                        <Text style={styles.body}>{name}</Text>
                      </View>
                      {member.role === 'owner' ? (
                        <Text style={styles.ownerBadge}>Owner</Text>
                      ) : null}
                    </View>
                  )
                })}
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

            {settlements.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Settle up</Text>
                {settlements.map((settlement) => (
                  <View
                    key={`${settlement.fromMemberId}-${settlement.toMemberId}`}
                    style={styles.rowBetween}
                  >
                    <Text style={styles.body}>
                      {labelForMember(settlement.fromMemberId)} →{' '}
                      {labelForMember(settlement.toMemberId)}
                    </Text>
                    <Text style={styles.amount}>
                      {formatAmount(settlement.amountCents, trip.currency)}
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
            <View style={styles.amountCol}>
              <Text style={styles.amount}>{formatAmount(item.amount_cents, item.currency)}</Text>
              {item.currency !== trip.currency ? (
                <Text style={styles.muted}>
                  ≈ {formatAmount(item.base_amount_cents, trip.currency)}
                </Text>
              ) : null}
            </View>
          </View>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: {
    gap: theme.gap(1),
    paddingBottom: theme.gap(3),
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
  inviteInfo: {
    flexShrink: 1,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: theme.gap(4),
  },
  regenerate: {
    alignSelf: 'flex-start',
    paddingTop: theme.gap(2),
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(1),
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.gap(8),
    height: theme.gap(8),
    borderRadius: theme.gap(4),
    backgroundColor: theme.colors.primary,
  },
  avatarText: {
    fontWeight: '700',
    color: theme.colors.primaryForeground,
  },
  ownerBadge: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  navLinks: {
    flexDirection: 'row',
    gap: theme.gap(6),
    paddingTop: theme.gap(3),
  },
  timelineLink: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  ownerActions: {
    flexDirection: 'row',
    gap: theme.gap(4),
    paddingTop: theme.gap(2),
  },
  deleteText: {
    color: theme.colors.destructive,
    fontWeight: '600',
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
  amountCol: {
    alignItems: 'flex-end',
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
