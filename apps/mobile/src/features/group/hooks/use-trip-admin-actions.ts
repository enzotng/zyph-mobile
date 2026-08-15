import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'

import { useDeleteTrip } from '@/features/trips'
import { haptics } from '@/lib/haptics'

import { useLeaveTrip, useRegenerateInviteCode } from './use-group'

type DestructiveConfirm = {
  title: string
  body: string
  confirmLabel: string
  failureTitle: string
  run: () => Promise<void>
}

export function useTripAdminActions(tripId: string) {
  const router = useRouter()
  const { t } = useTranslation()
  const regenerate = useRegenerateInviteCode(tripId)
  const deleteTripMutation = useDeleteTrip()
  const leaveTripMutation = useLeaveTrip()

  function confirmDestructive({
    title,
    body,
    confirmLabel,
    failureTitle,
    run,
  }: DestructiveConfirm) {
    haptics.warning()
    Alert.alert(title, body, [
      { text: t('common.cancel'), style: 'cancel' },
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
    isRegenerating: regenerate.isPending,
    isDeleting: deleteTripMutation.isPending,
    isLeaving: leaveTripMutation.isPending,
  }
}
