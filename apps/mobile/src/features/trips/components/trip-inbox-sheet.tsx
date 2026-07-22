import * as Clipboard from 'expo-clipboard'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Platform, Share, Switch, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { BottomSheet, Spinner } from '@/components/ui'
import {
  useCreateTripInboxAddress,
  useSetTripInboxAutoValidate,
  useTripInboxAddress,
} from '@/features/trips'
import { haptics } from '@/lib/haptics'

type TripInboxSheetProps = {
  open: boolean
  onClose: () => void
  tripId: string
}

const COPIED_RESET_MS = 1600

// Trip settings -> Trip inbox row: lets any active member generate the trip's shared inbound
// email address (forwarded booking emails become import proposals) and toggle auto-validation.
// Unlike CalendarFeedSheet's per-member show-once token, the address is a real cached query
// (useTripInboxAddress) - it is stable and meant to be re-displayed, not re-fetched on every open.
export function TripInboxSheet({ open, onClose, tripId }: TripInboxSheetProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const inbox = useTripInboxAddress(tripId)
  const createAddress = useCreateTripInboxAddress()
  const setAutoValidate = useSetTripInboxAutoValidate()
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear the pending "copied" flash timer on unmount (same as CalendarFeedSheet) so it can't fire
  // setState after the sheet is gone.
  useEffect(
    () => () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    },
    [],
  )

  // Forgets the "copied" flash the moment the sheet closes - the same render-phase "adjusting
  // state when a prop changes" idiom CalendarFeedSheet uses for its own token/copied state.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setCopied(false)
    }
  }

  function reportError(error: unknown) {
    haptics.error()
    // Never surface a raw RPC error - the alert is a fixed, translated string; the detail goes
    // to the dev console only.
    if (__DEV__) {
      console.warn('trip inbox address action failed', error)
    }
    Alert.alert(t('tripForm.inboxError'))
  }

  function generate() {
    createAddress.mutate(tripId, { onError: reportError })
  }

  function confirmRegenerate() {
    haptics.warning()
    Alert.alert(
      t('tripForm.inboxRegenerateConfirmTitle'),
      t('tripForm.inboxRegenerateConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('tripForm.inboxRegenerate'), style: 'destructive', onPress: generate },
      ],
    )
  }

  async function copyAddress(address: string) {
    await Clipboard.setStringAsync(address)
    setCopied(true)
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
  }

  function shareAddress(address: string) {
    void Share.share({ message: address })
  }

  function toggleAutoValidate(on: boolean) {
    haptics.selection()
    setAutoValidate.mutate({ tripId, on }, { onError: reportError })
  }

  const address = inbox.data

  return (
    <BottomSheet open={open} onClose={onClose} title={t('tripForm.inboxTitle')}>
      <Text style={styles.body}>{t('tripForm.inboxBody')}</Text>

      {inbox.isLoading ? (
        <View style={styles.loading}>
          <Spinner />
        </View>
      ) : inbox.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t('tripForm.inboxError')}</Text>
          <Button
            label={t('common.retry')}
            icon="refresh"
            variant="secondary"
            block={false}
            onPress={() => void inbox.refetch()}
          />
        </View>
      ) : !address ? (
        <Button
          label={t('tripForm.inboxGenerate')}
          icon="mail-outline"
          loading={createAddress.isPending}
          onPress={generate}
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.addressBox}>
            <Text style={styles.addressText} selectable numberOfLines={1} adjustsFontSizeToFit>
              {address.address}
            </Text>
          </View>

          <View style={styles.actions}>
            <Button
              label={copied ? t('tripForm.inboxCopied') : t('tripForm.inboxCopy')}
              icon={copied ? 'checkmark' : 'copy-outline'}
              variant="secondary"
              onPress={() => void copyAddress(address.address)}
            />
            <Button
              label={t('tripForm.inboxShare')}
              icon="share-outline"
              variant="secondary"
              onPress={() => shareAddress(address.address)}
            />
            <Button
              label={t('tripForm.inboxRegenerate')}
              icon="refresh-outline"
              variant="destructive"
              loading={createAddress.isPending}
              onPress={confirmRegenerate}
            />
          </View>

          <View style={styles.autoValidateRow}>
            <View style={styles.autoValidateInfo}>
              <Text style={styles.autoValidateLabel}>{t('tripForm.inboxAutoValidate')}</Text>
              <Text style={styles.autoValidateHint}>{t('tripForm.inboxAutoValidateHint')}</Text>
            </View>
            <Switch
              value={address.autoValidate}
              onValueChange={toggleAutoValidate}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              disabled={setAutoValidate.isPending}
              accessibilityLabel={t('tripForm.inboxAutoValidate')}
            />
          </View>

          <Text style={styles.privacyNote}>{t('tripForm.inboxPrivacyNote')}</Text>
        </View>
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create((theme) => ({
  body: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginBottom: theme.gap(4),
  },
  loading: {
    paddingVertical: theme.gap(6),
    alignItems: 'center',
  },
  errorBox: {
    gap: theme.gap(3),
    alignItems: 'center',
    paddingVertical: theme.gap(2),
  },
  errorText: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
    textAlign: 'center',
  },
  content: {
    gap: theme.gap(4),
  },
  addressBox: {
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  addressText: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  actions: {
    gap: theme.gap(2),
  },
  autoValidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  autoValidateInfo: {
    flex: 1,
    gap: theme.gap(1),
  },
  autoValidateLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  autoValidateHint: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  privacyNote: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
}))
