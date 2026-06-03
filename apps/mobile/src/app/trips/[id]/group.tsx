import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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

  const nameById = useMemo(
    () => new Map((members ?? []).map((member) => [member.id, member.display_name])),
    [members],
  )
  const userIdByMember = useMemo(
    () => new Map((balances ?? []).map((balance) => [balance.member_id, balance.user_id])),
    [balances],
  )

  const labelFor = useCallback(
    (memberUserId: string | null, memberId: string): string => {
      if (memberUserId && memberUserId === userId) {
        return t('common.you')
      }
      return nameById.get(memberId) ?? t('common.member')
    },
    [nameById, userId, t],
  )

  const labelForMember = useCallback(
    (memberId: string): string => labelFor(userIdByMember.get(memberId) ?? null, memberId),
    [labelFor, userIdByMember],
  )

  const settlements = useMemo(
    () =>
      settleBalances(
        (balances ?? []).map((balance) => ({
          memberId: balance.member_id,
          balanceCents: balance.balance_cents ?? 0,
        })),
      ),
    [balances],
  )

  function toggleSharing() {
    if (sharing) {
      setSharing(false)
      return
    }
    Alert.alert(
      'Partager ta position',
      'Les autres membres de ce voyage verront ta position en direct tant que le partage est actif. Désactive-le à tout moment pour arrêter.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('group.share'), onPress: () => setSharing(true) },
      ],
    )
  }

  if (isLoading) {
    return (
      <Screen title={t('group.title')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (isError || !trip) {
    return (
      <Screen title={t('group.title')} showBack>
        <View style={styles.center}>
          <Text style={styles.notFound}>{t('group.notFound')}</Text>
        </View>
      </Screen>
    )
  }

  async function shareInvite() {
    if (!trip) {
      return
    }
    await Share.share({
      message: t('group.shareInvite', { title: trip.title, code: trip.invite_code }),
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
      'Régénérer le code d’invitation',
      'Le code actuel cessera de fonctionner. Les personnes déjà inscrites conservent leur accès.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('group.regenerate'),
          style: 'destructive',
          onPress: async () => {
            try {
              await regenerate.mutateAsync()
            } catch (error) {
              Alert.alert(
                'Régénération impossible',
                error instanceof Error ? error.message : t('common.tryAgain'),
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
      t('group.deleteTrip'),
      'Cette action supprime définitivement le voyage et toutes ses données.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrip.mutateAsync(tripId)
              router.replace('/')
            } catch (error) {
              Alert.alert(
                'Suppression impossible',
                error instanceof Error ? error.message : t('common.tryAgain'),
              )
            }
          },
        },
      ],
    )
  }

  function confirmLeave() {
    Alert.alert(
      t('group.leaveTrip'),
      'Tu ne verras plus ce voyage ni ses dépenses. Les dépenses passées que tu as payées ou que tu dois restent comptabilisées.',
      [
        { text: t('common.cancel'), style: 'cancel' },
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
                error instanceof Error ? error.message : t('common.tryAgain'),
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
      `${name} perdra l’accès à ce voyage. Les dépenses passées payées ou dues restent comptabilisées.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('group.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember.mutateAsync(memberId)
            } catch (error) {
              Alert.alert(
                'Retrait impossible',
                error instanceof Error ? error.message : t('common.tryAgain'),
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
      title={t('group.title')}
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
            <Text style={styles.inviteLabel}>{t('group.inviteCode')}</Text>
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
            label={copied ? t('group.copied') : t('group.copy')}
            icon={copied ? 'checkmark' : 'copy-outline'}
            variant="secondary"
            size="sm"
            block={false}
            onPress={() => void copyInvite()}
          />
          <Button
            label={t('group.share')}
            icon="share-outline"
            variant="secondary"
            size="sm"
            block={false}
            onPress={() => void shareInvite()}
          />
          {isOwner ? (
            <Button
              label={regenerate.isPending ? t('group.regenerating') : t('group.regenerate')}
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
        <SectionTitle>{t('group.suggestedSettlements')}</SectionTitle>
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
                      {` ${t('group.owesTo')} `}
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
              <Text style={styles.settledText} numberOfLines={2}>
                {t('group.allUpToDate')}
              </Text>
            </Squircle>
          )}
        </View>
      </View>

      {/* Balances */}
      {hasBalances ? (
        <View>
          <SectionTitle>{t('group.balances')}</SectionTitle>
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
          <SectionTitle>{t('group.members', { count: members.length })}</SectionTitle>
          <View style={styles.listBody}>
            {members.map((member, index) => {
              const name =
                member.user_id === userId
                  ? t('common.you')
                  : (member.display_name ?? t('common.member'))
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
                    <Badge label={t('group.organizer')} tone="primary" />
                  ) : canRemove ? (
                    <Pressable
                      onPress={() => confirmRemove(member.id, name)}
                      disabled={removeMember.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`Retirer ${name}`}
                      hitSlop={6}
                      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
                    >
                      <Text style={styles.removeText}>{t('group.remove')}</Text>
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
        accessibilityLabel={t('group.shareLocationToggle')}
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
                {sharing ? 'Position partagée' : t('group.shareLocationToggle')}
              </Text>
              <Text style={styles.shareSub} numberOfLines={2}>
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
          accessibilityLabel={t('group.deleteTrip')}
          accessibilityState={{ disabled: deleteTrip.isPending }}
          style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]}
        >
          <Text style={styles.dangerText} numberOfLines={1}>
            {deleteTrip.isPending ? 'Suppression…' : t('group.deleteTrip')}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={confirmLeave}
          disabled={leaveTripMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel={t('group.leaveTrip')}
          accessibilityState={{ disabled: leaveTripMutation.isPending }}
          style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]}
        >
          <Text style={styles.dangerText} numberOfLines={1}>
            {leaveTripMutation.isPending ? 'En cours…' : t('group.leaveTrip')}
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
