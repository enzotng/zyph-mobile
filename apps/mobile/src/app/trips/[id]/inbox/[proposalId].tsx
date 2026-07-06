import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { Spinner } from '@/components/ui'
import { useTripMembers } from '@/features/group'
import { useProposals, useRejectProposal, useValidateProposal } from '@/features/inbox'
import {
  EventPreviewCard,
  type PreviewEvent,
  parsedToPreview,
  previewsToEvents,
} from '@/features/smart-import'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

export default function InboxProposalScreen() {
  const params = useGlobalSearchParams<{ id: string; proposalId: string }>()
  const tripId = paramString(params.id)
  const proposalId = paramString(params.proposalId)
  const router = useRouter()
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  const { data: proposals, isLoading } = useProposals(tripId)
  const proposal = proposals?.find((p) => p.id === proposalId) ?? null
  const members = useTripMembers(tripId)
  const validateProposal = useValidateProposal(tripId)
  const rejectProposal = useRejectProposal(tripId)

  const activeMembers = (members.data ?? []).filter((m) => m.status === 'active' && m.user_id)

  const [previews, setPreviews] = useState<PreviewEvent[] | null>(null)
  // Builds the editable previews exactly once per proposal - a later members refetch (or an
  // in-progress edit) must never clobber what the reviewer already changed. Adjusted during
  // render (React's supported derived-state pattern, tracked in state rather than a ref so
  // the render itself never reads/writes a ref), mirroring TripInboxSheet's own prop-driven
  // state reset, rather than an effect-plus-extra-render.
  const [builtForId, setBuiltForId] = useState<string | null>(null)
  if (proposal && members.data && builtForId !== proposal.id) {
    setBuiltForId(proposal.id)
    const memberInputs = activeMembers.map((m) => ({
      userId: m.user_id,
      displayName: m.display_name,
    }))
    setPreviews(
      (proposal.events ?? []).map((event, index) =>
        parsedToPreview(event, index, memberInputs, t('smartImport.defaultTitle')),
      ),
    )
  }

  function togglePreview(key: string) {
    setPreviews((prev) =>
      prev ? prev.map((p) => (p.key === key ? { ...p, included: !p.included } : p)) : prev,
    )
  }

  function patchPreview(
    key: string,
    patch: Partial<Pick<PreviewEvent, 'title' | 'startsAt' | 'notes' | 'participantIds'>>,
  ) {
    setPreviews((prev) => (prev ? prev.map((p) => (p.key === key ? { ...p, ...patch } : p)) : prev))
  }

  async function onValidate() {
    if (!proposal || !previews) {
      return
    }
    const included = previews.filter((p) => p.included)
    try {
      await validateProposal.mutateAsync({
        proposalId: proposal.id,
        events: previewsToEvents(included, t('smartImport.defaultTitle')),
      })
      haptics.success()
      router.back()
    } catch (error) {
      haptics.error()
      if (__DEV__) {
        console.warn('validate proposal failed', error)
      }
      Alert.alert(t('inbox.validateError'), t('common.tryAgain'))
    }
  }

  function confirmReject() {
    if (!proposal) {
      return
    }
    haptics.warning()
    Alert.alert(t('inbox.rejectConfirmTitle'), t('inbox.rejectConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('inbox.reject'),
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectProposal.mutateAsync(proposal.id)
            haptics.success()
            router.back()
          } catch (error) {
            haptics.error()
            if (__DEV__) {
              console.warn('reject proposal failed', error)
            }
            Alert.alert(t('inbox.rejectError'), t('common.tryAgain'))
          }
        },
      },
    ])
  }

  if (isLoading && !proposal) {
    return (
      <Screen title={t('inbox.reviewTitle')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (!proposal) {
    return (
      <Screen title={t('inbox.reviewTitle')} showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('inbox.notFound')}</Text>
        </View>
      </Screen>
    )
  }

  const includedCount = previews?.filter((p) => p.included).length ?? 0
  const busy = validateProposal.isPending || rejectProposal.isPending

  return (
    <Screen
      title={t('inbox.reviewTitle')}
      showBack
      scroll
      footer={
        <View style={styles.footerButtons}>
          <Button
            label={validateProposal.isPending ? t('inbox.validating') : t('inbox.validate')}
            onPress={onValidate}
            disabled={busy || includedCount === 0}
          />
          <Button
            label={rejectProposal.isPending ? t('inbox.rejecting') : t('inbox.reject')}
            variant="destructive"
            onPress={confirmReject}
            disabled={busy}
          />
        </View>
      }
    >
      <View style={styles.securityBanner}>
        <Ionicons name="shield-outline" size={18} color={theme.colors.destructive} />
        <View style={styles.securityInfo}>
          <Text style={styles.securityTitle}>{t('inbox.securityTitle')}</Text>
          <Text style={styles.securityBody}>{t('inbox.securityBody')}</Text>
          {/* Full SMTP address, never a display name - anti-phishing. Plain text, never linkified. */}
          <Text style={styles.senderText} selectable>
            {t('inbox.senderLabel', { sender: proposal.sender_email ?? '' })}
          </Text>
        </View>
      </View>

      {(previews ?? []).map((preview) => (
        <EventPreviewCard
          key={preview.key}
          preview={preview}
          activeMembers={activeMembers}
          onToggle={togglePreview}
          onPatch={patchPreview}
        />
      ))}
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  securityBanner: {
    flexDirection: 'row',
    gap: theme.gap(2.5),
    padding: theme.gap(3.5),
    borderRadius: theme.radius.lg,
    backgroundColor: withAlpha(theme.colors.destructive, 0.1),
  },
  securityInfo: {
    flex: 1,
    gap: theme.gap(1),
  },
  securityTitle: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
  },
  securityBody: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
  },
  senderText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    marginTop: theme.gap(1),
  },
  footerButtons: {
    gap: theme.gap(2),
  },
}))
