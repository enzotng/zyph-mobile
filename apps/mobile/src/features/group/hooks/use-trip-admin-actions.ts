import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Alert, Share } from 'react-native'

import {
  getTripInboxAddress,
  type TripInboxAddress,
  tripInboxAddressQueryKey,
  useCreateTripInboxAddress,
  useDeleteTrip,
  useSetTripInboxAutoValidate,
} from '@/features/trips'
import { haptics } from '@/lib/haptics'

import { useLeaveTrip, useRegenerateInviteCode } from './use-group'

type DestructiveConfirm = {
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  failureTitle: string
  run: () => Promise<void>
}

export function useTripAdminActions(tripId: string) {
  const router = useRouter()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const regenerate = useRegenerateInviteCode(tripId)
  const createInbox = useCreateTripInboxAddress()
  const setInboxAutoValidate = useSetTripInboxAutoValidate()
  const deleteTripMutation = useDeleteTrip()
  const leaveTripMutation = useLeaveTrip()

  function confirmDestructive({
    title,
    body,
    confirmLabel,
    cancelLabel = t('common.cancel'),
    failureTitle,
    run,
  }: DestructiveConfirm) {
    haptics.warning()
    Alert.alert(title, body, [
      { text: cancelLabel, style: 'cancel' },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: async () => {
          try {
            await run()
          } catch (error) {
            // A SQLSTATE other than P0001 is Postgres talking about itself - a constraint, a
            // policy, a timeout - and naming them to the user discloses schema. P0001 is a plpgsql
            // RAISE EXCEPTION, i.e. copy an RPC wrote for them, and a plain Error comes from our
            // own client code: both are meant to be read.
            const code = (error as { code?: string } | null)?.code
            const isInternal = typeof code === 'string' && code !== 'P0001'
            const message =
              !isInternal && error instanceof Error ? error.message : t('common.tryAgain')
            Alert.alert(failureTitle, message)
          }
        },
      },
    ])
  }

  function confirmRegenerate() {
    confirmDestructive({
      title: t('group.confirmRegenerateTitle'),
      body: t('group.confirmRegenerateBody'),
      confirmLabel: t('group.regenerate'),
      failureTitle: t('group.regenerateFailedTitle'),
      run: async () => {
        await regenerate.mutateAsync()
      },
    })
  }

  // Detaching or removing an account leaves the invite link working for it: the person can claim a
  // place again straight away. Rotating the code is the only way to stop that. The trip email is a
  // second way in that outlives membership, so it is offered alongside when the trip has one.
  async function offerNewInviteLink(name: string) {
    let inbox: TripInboxAddress | null = null
    let inboxChecked = true
    try {
      // Read fresh and once: a stale answer misses an address, and the app's retries or an offline
      // pause would hold the offer back until it no longer matches what the owner just did.
      inbox = await queryClient.fetchQuery({
        queryKey: tripInboxAddressQueryKey(tripId),
        queryFn: () => getTripInboxAddress(tripId),
        staleTime: 0,
        retry: false,
        networkMode: 'always',
      })
    } catch {
      inboxChecked = false
    }

    if (!inbox) {
      confirmDestructive({
        title: t('group.offerNewLinkTitle'),
        body: inboxChecked
          ? t('group.offerNewLinkBody', { name })
          : t('group.offerNewLinkInboxUncheckedBody', { name }),
        confirmLabel: t('group.changeLink'),
        cancelLabel: t('group.keepLink'),
        failureTitle: t('group.regenerateFailedTitle'),
        run: async () => {
          await regenerate.mutateAsync()
        },
      })
      return
    }

    confirmDestructive({
      title: t('group.offerNewLinkAndInboxTitle'),
      body: t('group.offerNewLinkAndInboxBody', { name }),
      confirmLabel: t('group.changeBoth'),
      cancelLabel: t('group.keepBoth'),
      failureTitle: t('group.regenerateFailedTitle'),
      run: async () => {
        await regenerate.mutateAsync()
        let address: string
        try {
          address = await createInbox.mutateAsync(tripId)
        } catch {
          throw new Error(t('group.inboxRotateFailedBody'))
        }
        // A new address starts with auto-validation off; failing to restore it keeps the safer one.
        if (inbox.autoValidate) {
          await setInboxAutoValidate.mutateAsync({ tripId, on: true }).catch(() => undefined)
        }
        Alert.alert(t('group.newInboxTitle'), address, [
          { text: t('common.ok'), style: 'cancel' },
          { text: t('group.share'), onPress: () => void Share.share({ message: address }) },
        ])
      },
    })
  }

  function confirmDelete() {
    confirmDestructive({
      title: t('group.deleteTrip'),
      body: t('group.confirmDeleteBody'),
      confirmLabel: t('common.delete'),
      failureTitle: t('group.deleteFailedTitle'),
      run: async () => {
        await deleteTripMutation.mutateAsync(tripId)
        router.replace('/')
      },
    })
  }

  function confirmLeave() {
    confirmDestructive({
      title: t('group.leaveTrip'),
      body: t('group.confirmLeaveBody'),
      confirmLabel: t('group.leave'),
      failureTitle: t('group.leaveFailedTitle'),
      run: async () => {
        await leaveTripMutation.mutateAsync(tripId)
        router.replace('/')
      },
    })
  }

  return {
    confirmRegenerate,
    confirmDelete,
    confirmLeave,
    offerNewInviteLink,
    isRegenerating: regenerate.isPending,
    isDeleting: deleteTripMutation.isPending,
    isLeaving: leaveTripMutation.isPending,
  }
}
