import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import { Squircle } from '@/components/ui'
import { useAuth } from '@/features/auth'
import { formatAmount, settleBalances, useTripBalances } from '@/features/expenses'
import {
  useLeaveTrip,
  useRegenerateInviteCode,
  useRemoveTripMember,
  useTripMembers,
} from '@/features/group'
import { useDeleteTrip, useTrip } from '@/features/trips'
import { useShareLocation } from '@/features/wayfinder'
import { getShareLocation, setShareLocation } from '@/lib/preferences'
import { paramString } from '@/lib/routing'

export default function TripOverviewScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { data: trip, isLoading, isError } = useTrip(tripId)
  const { data: balances } = useTripBalances(tripId)
  const { data: members } = useTripMembers(tripId)
  const { session } = useAuth()
  const userId = session?.user.id
  const router = useRouter()
  const deleteTrip = useDeleteTrip()
  const regenerate = useRegenerateInviteCode(tripId)
  const leaveTripMutation = useLeaveTrip()
  const removeMember = useRemoveTripMember(tripId)
  const { theme } = useUnistyles()

  const [sharing, setSharing] = useState(() => getShareLocation(tripId))
  const { status: shareStatus } = useShareLocation({ tripId, enabled: sharing })

  useEffect(() => {
    setShareLocation(tripId, sharing)
  }, [sharing, tripId])

  function toggleSharing() {
    if (sharing) {
      setSharing(false)
      return
    }
    Alert.alert(
      'Share your location',
      'Other members of this trip will see your live position while sharing is on. Turn it off any time to stop.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share', onPress: () => setSharing(true) },
      ],
    )
  }

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

  function confirmLeave() {
    Alert.alert(
      'Leave trip',
      'You will no longer see this trip or its expenses. Past expenses you paid for or owe stay on the books.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveTripMutation.mutateAsync(tripId)
              router.replace('/')
            } catch (error) {
              Alert.alert(
                'Could not leave',
                error instanceof Error ? error.message : 'Please try again.',
              )
            }
          },
        },
      ],
    )
  }

  function confirmRemove(memberId: string, name: string) {
    Alert.alert(
      'Remove member',
      `${name} will lose access to this trip. Past expenses they paid for or owe stay on the books.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember.mutateAsync(memberId)
            } catch (error) {
              Alert.alert(
                'Could not remove',
                error instanceof Error ? error.message : 'Please try again.',
              )
            }
          },
        },
      ],
    )
  }

  return (
    <Screen title={trip.title} showBack scroll>
      {trip.destination ? <Text style={styles.subtitle}>{trip.destination}</Text> : null}

      {isOwner ? (
        <View style={styles.ownerActions}>
          <Link href={{ pathname: '/trips/[id]/edit', params: { id: tripId } }} style={styles.link}>
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

      <Squircle
        color={theme.colors.card}
        borderWidth={0}
        radius={theme.radius.lg}
        style={styles.inviteRow}
      >
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
      </Squircle>

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

      <Pressable
        onPress={toggleSharing}
        accessibilityRole="switch"
        accessibilityState={{ checked: sharing }}
      >
        <Squircle
          color={theme.colors.card}
          borderWidth={0}
          radius={theme.radius.lg}
          style={styles.shareRow}
        >
          <Ionicons
            name={sharing ? 'location' : 'location-outline'}
            size={22}
            color={sharing ? theme.colors.primary : theme.colors.muted}
          />
          <View style={styles.shareInfo}>
            <Text style={styles.body}>{sharing ? 'Sharing my location' : 'Share my location'}</Text>
            <Text style={styles.muted}>
              {shareStatus === 'denied'
                ? 'Permission denied. Enable Location in Settings.'
                : shareStatus === 'error'
                  ? 'Could not start sharing. Tap to retry.'
                  : sharing
                    ? 'Other members can see you in real time.'
                    : 'Off - your position stays private.'}
            </Text>
          </View>
          <Ionicons
            name={sharing ? 'toggle' : 'toggle-outline'}
            size={28}
            color={sharing ? theme.colors.primary : theme.colors.muted}
          />
        </Squircle>
      </Pressable>

      {members && members.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members ({members.length})</Text>
          {members.map((member) => {
            const name = member.user_id === userId ? 'You' : (member.display_name ?? 'Member')
            const initial = name.charAt(0).toUpperCase()
            const canRemove = isOwner && member.role !== 'owner' && member.user_id !== userId
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
                ) : canRemove ? (
                  <Pressable
                    onPress={() => confirmRemove(member.id, name)}
                    disabled={removeMember.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${name}`}
                    hitSlop={6}
                  >
                    <Text style={styles.deleteText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : null}

      {!isOwner ? (
        <Pressable
          onPress={confirmLeave}
          disabled={leaveTripMutation.isPending}
          accessibilityRole="button"
          style={styles.leaveBtn}
        >
          <Text style={styles.deleteText}>
            {leaveTripMutation.isPending ? 'Leaving…' : 'Leave trip'}
          </Text>
        </Pressable>
      ) : null}

      {balances && balances.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Balances</Text>
          {balances.map((balance) => (
            <View key={balance.member_id} style={styles.rowBetween}>
              <Text style={styles.body}>{labelFor(balance.user_id, balance.member_id)}</Text>
              <Text
                style={[styles.amount, (balance.balance_cents ?? 0) < 0 ? styles.negative : null]}
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
                {labelForMember(settlement.fromMemberId)} → {labelForMember(settlement.toMemberId)}
              </Text>
              <Text style={styles.amount}>
                {formatAmount(settlement.amountCents, trip.currency)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.spacer} />
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: theme.gap(4),
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
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
  },
  code: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
  },
  shareInfo: {
    flex: 1,
    gap: theme.gap(1),
  },
  section: {
    gap: theme.gap(1),
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
  deleteText: {
    color: theme.colors.destructive,
    fontWeight: '600',
  },
  leaveBtn: {
    alignSelf: 'flex-start',
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
  spacer: {
    height: FLOATING_TAB_BAR_CLEARANCE,
  },
}))
