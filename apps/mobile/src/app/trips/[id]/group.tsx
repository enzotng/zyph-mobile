import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Share, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { Avatar, Badge, Card, SectionTitle, Spinner, Surface } from '@/components/ui'
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

export default function TripGroupScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { data: trip, isLoading, isError } = useTrip(tripId)
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
      title={t('group.title')}
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
      {/* Invite code */}
      <Card>
        <View style={styles.inviteRow}>
          <View style={styles.inviteInfo}>
            <Text style={styles.inviteLabel}>{t('group.inviteCode')}</Text>
            <Text style={styles.code}>{trip.invite_code}</Text>
          </View>
          <Surface
            width={48}
            height={48}
            radius={theme.radius.md}
            borderWidth={0}
            color={withAlpha(theme.colors.primary, 0.12)}
            style={styles.inviteMark}
          >
            <Ionicons name="people" size={24} color={theme.colors.primary} />
          </Surface>
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

      {/* Balances & settle up -> dedicated screen */}
      <Pressable
        onPress={() => router.push({ pathname: '/trips/[id]/balances', params: { id: tripId } })}
        accessibilityRole="button"
        accessibilityLabel={t('balances.title')}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}
      >
        <Card padding={theme.gap(4)}>
          <View style={styles.shareRow}>
            <Ionicons name="scale-outline" size={22} color={theme.colors.primary} />
            <View style={styles.shareInfo}>
              <Text style={styles.shareTitle}>{t('balances.title')}</Text>
              <Text style={styles.shareSub} numberOfLines={1}>
                {t('group.suggestedSettlements')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.muted} />
          </View>
        </Card>
      </Pressable>

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
                    <Avatar name={name} imageUrl={member.avatar_url} size={34} />
                    <Text style={styles.memberName}>{name}</Text>
                  </View>
                  {member.role === 'owner' ? (
                    <Badge label={t('group.organizer')} tone="primary" />
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
                {sharing ? t('group.sharingActive') : t('group.shareLocationToggle')}
              </Text>
              <Text style={styles.shareSub} numberOfLines={2}>
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
