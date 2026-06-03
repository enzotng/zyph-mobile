import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, Pressable, Share, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { Amount, Avatar, Badge, Card, SectionTitle, Spinner, Squircle } from '@/components/ui'
import { useAuth } from '@/features/auth'
import { settleBalances, useTripBalances } from '@/features/expenses'
import {
  useLeaveTrip,
  useRegenerateInviteCode,
  useRemoveTripMember,
  useTripMembers,
} from '@/features/group'
import { useDeleteTrip, useTrip } from '@/features/trips'
import { useShareLocation } from '@/features/wayfinder'
import { withAlpha } from '@/lib/color'
import { getShareLocation, setShareLocation } from '@/lib/preferences'
import { paramString } from '@/lib/routing'

export default function TripGroupScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
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
  const [copied, setCopied] = useState(false)
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
      'Partager ta position',
      'Les autres membres de ce voyage verront ta position en direct tant que le partage est actif. Désactive-le à tout moment pour arrêter.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Partager', onPress: () => setSharing(true) },
      ],
    )
  }

  if (isLoading) {
    return (
      <Screen title="Groupe & soldes" showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (isError || !trip) {
    return (
      <Screen title="Groupe & soldes" showBack>
        <View style={styles.center}>
          <Text style={styles.notFound}>Voyage introuvable.</Text>
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
      return 'Toi'
    }
    return nameById.get(memberId) ?? 'Membre'
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
      message: `Rejoins mon voyage "${trip.title}" sur ZYPH avec le code d'invitation : ${trip.invite_code}`,
    })
  }

  async function copyInvite() {
    if (!trip) {
      return
    }
    await Clipboard.setStringAsync(trip.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  function confirmRegenerate() {
    Alert.alert(
      "Régénérer le code d'invitation",
      'Le code actuel cessera de fonctionner. Les personnes déjà inscrites conservent leur accès.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Régénérer',
          style: 'destructive',
          onPress: async () => {
            try {
              await regenerate.mutateAsync()
            } catch (error) {
              Alert.alert(
                'Régénération impossible',
                error instanceof Error ? error.message : 'Veuillez réessayer.',
              )
            }
          },
        },
      ],
    )
  }

  const isOwner = trip.owner_id === userId

  function confirmDelete() {
    Alert.alert(
      'Supprimer le voyage',
      'Cette action supprime définitivement le voyage et toutes ses données.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrip.mutateAsync(tripId)
              router.replace('/')
            } catch (error) {
              Alert.alert(
                'Suppression impossible',
                error instanceof Error ? error.message : 'Veuillez réessayer.',
              )
            }
          },
        },
      ],
    )
  }

  function confirmLeave() {
    Alert.alert(
      'Quitter le voyage',
      'Tu ne verras plus ce voyage ni ses dépenses. Les dépenses passées que tu as payées ou que tu dois restent comptabilisées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveTripMutation.mutateAsync(tripId)
              router.replace('/')
            } catch (error) {
              Alert.alert(
                'Impossible de quitter',
                error instanceof Error ? error.message : 'Veuillez réessayer.',
              )
            }
          },
        },
      ],
    )
  }

  function confirmRemove(memberId: string, name: string) {
    Alert.alert(
      'Retirer le membre',
      `${name} perdra l'accès à ce voyage. Les dépenses passées payées ou dues restent comptabilisées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember.mutateAsync(memberId)
            } catch (error) {
              Alert.alert(
                'Retrait impossible',
                error instanceof Error ? error.message : 'Veuillez réessayer.',
              )
            }
          },
        },
      ],
    )
  }

  const hasSettlements = settlements.length > 0
  const hasBalances = balances != null && balances.length > 0
  const hasMembers = members != null && members.length > 0

  return (
    <Screen
      title="Groupe & soldes"
      showBack
      scroll
      right={
        isOwner ? (
          <Pressable
            onPress={() => router.push({ pathname: '/trips/[id]/edit', params: { id: tripId } })}
            accessibilityRole="button"
            accessibilityLabel="Modifier le voyage"
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={22} color={theme.colors.foreground} />
          </Pressable>
        ) : undefined
      }
    >
      {/* Invite code */}
      <Card>
        <View style={styles.inviteRow}>
          <View style={styles.inviteInfo}>
            <Text style={styles.inviteLabel}>Code d’invitation</Text>
            <Text style={styles.code}>{trip.invite_code}</Text>
          </View>
          <Squircle
            width={48}
            height={48}
            radius={theme.radius.md}
            borderWidth={0}
            color={withAlpha(theme.colors.primary, 0.12)}
            style={styles.inviteMark}
          >
            <Ionicons name="people" size={24} color={theme.colors.primary} />
          </Squircle>
        </View>
        <View style={styles.inviteActions}>
          <Button
            label={copied ? 'Copié !' : 'Copier'}
            icon={copied ? 'checkmark' : 'copy-outline'}
            variant="secondary"
            size="sm"
            block={false}
            onPress={() => void copyInvite()}
          />
          <Button
            label="Partager"
            icon="share-outline"
            variant="secondary"
            size="sm"
            block={false}
            onPress={() => void shareInvite()}
          />
          {isOwner ? (
            <Button
              label={regenerate.isPending ? 'Régénération…' : 'Régénérer'}
              icon="refresh-outline"
              variant="ghost"
              size="sm"
              block={false}
              disabled={regenerate.isPending}
              onPress={confirmRegenerate}
            />
          ) : null}
        </View>
      </Card>

      {/* Settle up */}
      <View>
        <SectionTitle>Règlements suggérés</SectionTitle>
        <View style={styles.blockBody}>
          {hasSettlements ? (
            <View style={styles.settleList}>
              {settlements.map((settlement) => (
                <Card
                  key={`${settlement.fromMemberId}-${settlement.toMemberId}`}
                  padding={theme.gap(3)}
                >
                  <View style={styles.settleRow}>
                    <Avatar name={labelForMember(settlement.fromMemberId)} size={32} />
                    <Ionicons name="arrow-forward" size={16} color={theme.colors.muted} />
                    <Avatar name={labelForMember(settlement.toMemberId)} size={32} />
                    <Text style={styles.settleText} numberOfLines={2}>
                      <Text style={styles.settleName}>
                        {labelForMember(settlement.fromMemberId)}
                      </Text>
                      {' doit à '}
                      <Text style={styles.settleName}>{labelForMember(settlement.toMemberId)}</Text>
                    </Text>
                    <Amount
                      cents={settlement.amountCents}
                      currency={trip.currency}
                      size={15}
                      neutral
                    />
                  </View>
                </Card>
              ))}
            </View>
          ) : (
            <Squircle
              borderWidth={0}
              radius={theme.radius.lg}
              color={withAlpha(theme.colors.success, 0.1)}
              style={styles.settledBanner}
            >
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
              <Text style={styles.settledText}>Tout le monde est à jour.</Text>
            </Squircle>
          )}
        </View>
      </View>

      {/* Balances */}
      {hasBalances ? (
        <View>
          <SectionTitle>Soldes</SectionTitle>
          <View style={styles.listBody}>
            {balances.map((balance, index) => (
              <View
                key={balance.member_id}
                style={[styles.listRow, index === balances.length - 1 && styles.listRowLast]}
              >
                <View style={styles.rowMember}>
                  <Avatar name={labelFor(balance.user_id, balance.member_id)} size={30} />
                  <Text style={styles.memberName}>
                    {labelFor(balance.user_id, balance.member_id)}
                  </Text>
                </View>
                <Amount
                  cents={balance.balance_cents ?? 0}
                  currency={trip.currency}
                  size={15}
                  signed
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Members */}
      {hasMembers ? (
        <View>
          <SectionTitle>{`Membres (${members.length})`}</SectionTitle>
          <View style={styles.listBody}>
            {members.map((member, index) => {
              const name = member.user_id === userId ? 'Toi' : (member.display_name ?? 'Membre')
              const canRemove = isOwner && member.role !== 'owner' && member.user_id !== userId
              return (
                <View
                  key={member.id}
                  style={[styles.listRow, index === members.length - 1 && styles.listRowLast]}
                >
                  <View style={styles.rowMember}>
                    <Avatar name={name} size={34} />
                    <Text style={styles.memberName}>{name}</Text>
                  </View>
                  {member.role === 'owner' ? (
                    <Badge label="Organisateur" tone="primary" />
                  ) : canRemove ? (
                    <Pressable
                      onPress={() => confirmRemove(member.id, name)}
                      disabled={removeMember.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer ${name}`}
                      hitSlop={6}
                      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
                    >
                      <Text style={styles.removeText}>Retirer</Text>
                    </Pressable>
                  ) : null}
                </View>
              )
            })}
          </View>
        </View>
      ) : null}

      {/* Share location */}
      <Pressable
        onPress={toggleSharing}
        accessibilityRole="switch"
        accessibilityState={{ checked: sharing }}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}
      >
        <Card padding={theme.gap(4)}>
          <View style={styles.shareRow}>
            <Ionicons
              name={sharing ? 'location' : 'location-outline'}
              size={22}
              color={sharing ? theme.colors.primary : theme.colors.muted}
            />
            <View style={styles.shareInfo}>
              <Text style={styles.shareTitle}>
                {sharing ? 'Position partagée' : 'Partager ma position'}
              </Text>
              <Text style={styles.shareSub}>
                {shareStatus === 'denied'
                  ? 'Autorisation refusée. Active la localisation dans les Réglages.'
                  : shareStatus === 'error'
                    ? 'Impossible de démarrer le partage. Touche pour réessayer.'
                    : sharing
                      ? 'Les autres membres te voient en temps réel.'
                      : 'Désactivé - ta position reste privée.'}
              </Text>
            </View>
            <Ionicons
              name={sharing ? 'toggle' : 'toggle-outline'}
              size={30}
              color={sharing ? theme.colors.primary : theme.colors.muted}
            />
          </View>
        </Card>
      </Pressable>

      {/* Danger zone */}
      {isOwner ? (
        <Pressable
          onPress={confirmDelete}
          disabled={deleteTrip.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]}
        >
          <Text style={styles.dangerText}>
            {deleteTrip.isPending ? 'Suppression…' : 'Supprimer le voyage'}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={confirmLeave}
          disabled={leaveTripMutation.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]}
        >
          <Text style={styles.dangerText}>
            {leaveTripMutation.isPending ? 'En cours…' : 'Quitter le voyage'}
          </Text>
        </Pressable>
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
  notFound: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(3),
  },
  inviteInfo: {
    flexShrink: 1,
  },
  inviteLabel: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  code: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xl,
    letterSpacing: 1.5,
    color: theme.colors.foreground,
    marginTop: 2,
  },
  inviteMark: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  inviteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2.5),
    marginTop: theme.gap(3.5),
  },
  blockBody: {
    marginTop: theme.gap(2.5),
  },
  settleList: {
    gap: theme.gap(2.5),
  },
  settleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  settleText: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  settleName: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
    paddingVertical: theme.gap(3.5),
    paddingHorizontal: theme.gap(4),
  },
  settledText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  listBody: {
    marginTop: theme.gap(1),
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  rowMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2.5),
    flexShrink: 1,
  },
  memberName: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  removeText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  shareInfo: {
    flex: 1,
    gap: theme.gap(0.5),
  },
  shareTitle: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  shareSub: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  dangerBtn: {
    alignSelf: 'flex-start',
  },
  dangerText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.destructive,
  },
  pressed: {
    opacity: 0.85,
  },
}))
