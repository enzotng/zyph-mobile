import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as Linking from 'expo-linking'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Share, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { Avatar, Card, ErrorState, Spinner, Surface } from '@/components/ui'
import { useAuth } from '@/features/auth'
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

// The invite card sits on the ink bezel (dark in both themes), so text uses fixed cream tones
// rather than theme.colors.foreground (mirrors RightNowCard / the spend feed balance card).
const CREAM = '#F4F1E8'
const CREAM_MUTED = 'rgba(244, 241, 232, 0.62)'
const CREAM_FILL = 'rgba(244, 241, 232, 0.12)'

export default function TripGroupScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { data: trip, isLoading, isError, refetch } = useTrip(tripId)
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
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { status: shareStatus } = useShareLocation({ tripId, enabled: sharing })

  useEffect(() => {
    setShareLocation(tripId, sharing)
  }, [sharing, tripId])

  // Clear the "copied" reset timer if the screen unmounts before it fires.
  useEffect(
    () => () => {
      if (copiedTimer.current) {
        clearTimeout(copiedTimer.current)
      }
    },
    [],
  )

  function toggleSharing() {
    if (sharing) {
      setSharing(false)
      return
    }
    Alert.alert(t('group.shareLocationTitle'), t('group.shareLocationBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('group.share'), onPress: () => setSharing(true) },
    ])
  }

  if (isLoading) {
    return (
      <Screen title={t('group.heading')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen title={t('group.heading')} showBack>
        <ErrorState
          title={t('errors.title')}
          body={t('errors.body')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      </Screen>
    )
  }

  if (!trip) {
    return (
      <Screen title={t('group.heading')} showBack>
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
    // Deep link expo-router resolves automatically (scheme "zyph"): tapping it opens the join
    // screen, which auto-joins from the ?code param. The code stays in the message as a fallback
    // for anyone without the app installed.
    const url = Linking.createURL('/trips/join', { queryParams: { code: trip.invite_code } })
    await Share.share({
      message: t('group.shareInvite', { title: trip.title, code: trip.invite_code, url }),
      url,
    })
  }

  async function copyInvite() {
    if (!trip) {
      return
    }
    await Clipboard.setStringAsync(trip.invite_code)
    setCopied(true)
    if (copiedTimer.current) {
      clearTimeout(copiedTimer.current)
    }
    copiedTimer.current = setTimeout(() => setCopied(false), 1600)
  }

  function confirmRegenerate() {
    Alert.alert(t('group.confirmRegenerateTitle'), t('group.confirmRegenerateBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('group.regenerate'),
        style: 'destructive',
        onPress: async () => {
          try {
            await regenerate.mutateAsync()
          } catch (error) {
            Alert.alert(
              t('group.regenerateFailedTitle'),
              error instanceof Error ? error.message : t('common.tryAgain'),
            )
          }
        },
      },
    ])
  }

  const isOwner = trip.owner_id === userId

  function confirmDelete() {
    Alert.alert(t('group.deleteTrip'), t('group.confirmDeleteBody'), [
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
              t('group.deleteFailedTitle'),
              error instanceof Error ? error.message : t('common.tryAgain'),
            )
          }
        },
      },
    ])
  }

  function confirmLeave() {
    Alert.alert(t('group.leaveTrip'), t('group.confirmLeaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('group.leave'),
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveTripMutation.mutateAsync(tripId)
            router.replace('/')
          } catch (error) {
            Alert.alert(
              t('group.leaveFailedTitle'),
              error instanceof Error ? error.message : t('common.tryAgain'),
            )
          }
        },
      },
    ])
  }

  function confirmRemove(memberId: string, name: string) {
    Alert.alert(t('group.confirmRemoveTitle'), t('group.confirmRemoveBody', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('group.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember.mutateAsync(memberId)
          } catch (error) {
            Alert.alert(
              t('group.removeFailedTitle'),
              error instanceof Error ? error.message : t('common.tryAgain'),
            )
          }
        },
      },
    ])
  }

  const hasMembers = members != null && members.length > 0

  return (
    <Screen
      title={t('group.heading')}
      showBack
      scroll
      right={
        isOwner ? (
          <Pressable
            onPress={() => router.push({ pathname: '/trips/[id]/edit', params: { id: tripId } })}
            accessibilityRole="button"
            accessibilityLabel={t('group.editTripLabel')}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={22} color={theme.colors.foreground} />
          </Pressable>
        ) : undefined
      }
    >
      {/* Invite code - ink bezel card */}
      <View style={styles.inviteCard}>
        <Text style={styles.inviteEyebrow}>{t('group.inviteCode')}</Text>
        <Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit>
          {trip.invite_code}
        </Text>
        <View style={styles.inviteActions}>
          <Pressable
            onPress={() => void copyInvite()}
            accessibilityRole="button"
            accessibilityLabel={copied ? t('group.copied') : t('group.copy')}
            style={({ pressed }) => [styles.inviteTile, styles.copyTile, pressed && styles.pressed]}
          >
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={CREAM} />
            <Text style={styles.copyTileLabel}>{copied ? t('group.copied') : t('group.copy')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void shareInvite()}
            accessibilityRole="button"
            accessibilityLabel={t('group.share')}
            style={({ pressed }) => [
              styles.inviteTile,
              styles.shareTile,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="share-outline" size={18} color={theme.colors.primaryForeground} />
            <Text style={styles.shareTileLabel}>{t('group.share')}</Text>
          </Pressable>
        </View>
        <Text style={styles.inviteCaption}>{t('group.inviteCaption')}</Text>
      </View>

      {/* Balances & settle up -> dedicated screen */}
      <Pressable
        onPress={() => router.push({ pathname: '/trips/[id]/balances', params: { id: tripId } })}
        accessibilityRole="button"
        accessibilityLabel={t('balances.title')}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}
      >
        <Card padding={theme.gap(4)}>
          <View style={styles.rowCard}>
            <Surface
              width={40}
              height={40}
              radius={theme.radius.md}
              borderWidth={0}
              color={withAlpha(theme.colors.primary, 0.12)}
              style={styles.rowCardTile}
            >
              <Ionicons name="scale-outline" size={20} color={theme.colors.primary} />
            </Surface>
            <View style={styles.rowCardInfo}>
              <Text style={styles.rowCardTitle}>{t('balances.title')}</Text>
              <Text style={styles.rowCardSub} numberOfLines={1}>
                {t('group.suggestedSettlements')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
          </View>
        </Card>
      </Pressable>

      {/* Members */}
      {hasMembers ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>{t('group.membersTitle')}</Text>
            <Text style={styles.sectionCount}>{members.length}</Text>
          </View>
          <Surface
            color={theme.colors.card}
            borderColor={theme.colors.border}
            borderWidth={1}
            radius={theme.radius.lg}
            style={styles.membersCard}
          >
            {members.map((member, index) => {
              const name =
                member.user_id === userId
                  ? t('common.you')
                  : (member.display_name ?? t('common.member'))
              const isMemberOwner = member.role === 'owner'
              const canRemove = isOwner && !isMemberOwner && member.user_id !== userId
              return (
                <View
                  key={member.id}
                  style={[styles.memberRow, index === members.length - 1 && styles.memberRowLast]}
                >
                  <Avatar name={name} imageUrl={member.avatar_url} size={40} />
                  <Text style={styles.memberName} numberOfLines={1}>
                    {name}
                  </Text>
                  {isMemberOwner ? (
                    <View style={styles.ownerPill}>
                      <Text style={styles.ownerPillLabel}>{t('group.owner')}</Text>
                    </View>
                  ) : canRemove ? (
                    <Pressable
                      onPress={() => confirmRemove(member.id, name)}
                      disabled={removeMember.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={t('group.removeMemberLabel', { name })}
                      hitSlop={6}
                      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
                    >
                      <Text style={styles.removeText}>{t('group.remove')}</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.memberRole}>{t('group.memberRole')}</Text>
                  )}
                </View>
              )
            })}
          </Surface>
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
          <View style={styles.rowCard}>
            <Surface
              width={40}
              height={40}
              radius={theme.radius.md}
              borderWidth={0}
              color={withAlpha(
                sharing ? theme.colors.primary : theme.colors.muted,
                sharing ? 0.12 : 0.1,
              )}
              style={styles.rowCardTile}
            >
              <Ionicons
                name={sharing ? 'location' : 'location-outline'}
                size={20}
                color={sharing ? theme.colors.primary : theme.colors.muted}
              />
            </Surface>
            <View style={styles.rowCardInfo}>
              <Text style={styles.rowCardTitle}>
                {sharing ? t('group.sharingActive') : t('group.shareLocationToggle')}
              </Text>
              <Text style={styles.rowCardSub} numberOfLines={2}>
                {shareStatus === 'denied'
                  ? t('group.shareStatusDenied')
                  : shareStatus === 'error'
                    ? t('group.shareStatusError')
                    : sharing
                      ? t('group.shareStatusOn')
                      : t('group.shareStatusOff')}
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

      {/* Regenerate code - bordered full-width action (owner only) */}
      {isOwner ? (
        <Button
          label={regenerate.isPending ? t('group.regenerating') : t('trip.regenerateCode')}
          icon="refresh-outline"
          variant="secondary"
          disabled={regenerate.isPending}
          onPress={confirmRegenerate}
        />
      ) : null}

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
            {deleteTrip.isPending ? t('group.deleting') : t('group.deleteTrip')}
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
            {leaveTripMutation.isPending ? t('group.leaving') : t('group.leaveTrip')}
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
  // Invite-code bezel card: ink in both themes, cream text.
  inviteCard: {
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.bezel,
    paddingVertical: theme.gap(4),
    paddingHorizontal: theme.gap(4.5),
    gap: theme.gap(2),
  },
  inviteEyebrow: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: CREAM_MUTED,
  },
  code: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: 23,
    letterSpacing: 2,
    color: CREAM,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: theme.gap(2.5),
    marginTop: theme.gap(1),
  },
  inviteTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(1.5),
    minHeight: 44,
    paddingHorizontal: theme.gap(4),
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
  },
  copyTile: {
    backgroundColor: CREAM_FILL,
  },
  copyTileLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: CREAM,
  },
  shareTile: {
    backgroundColor: theme.colors.primary,
  },
  shareTileLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primaryForeground,
  },
  inviteCaption: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: CREAM_MUTED,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  rowCardTile: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  rowCardInfo: {
    flex: 1,
    gap: theme.gap(0.5),
  },
  rowCardTitle: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  rowCardSub: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  section: {
    gap: theme.gap(2),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  sectionEyebrow: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  sectionCount: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  membersCard: {
    paddingHorizontal: theme.gap(4),
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  memberRowLast: {
    borderBottomWidth: 0,
  },
  memberName: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  ownerPill: {
    alignSelf: 'flex-start',
    borderRadius: theme.radius.full,
    paddingVertical: 3,
    paddingHorizontal: theme.gap(2.5),
    backgroundColor: withAlpha(theme.colors.primary, 0.14),
  },
  ownerPillLabel: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
  memberRole: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  removeText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
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
