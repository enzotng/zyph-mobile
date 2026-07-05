import * as Clipboard from 'expo-clipboard'
import * as Linking from 'expo-linking'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { BottomSheet, Spinner } from '@/components/ui'
import { useCreateCalendarFeedToken } from '@/features/trips'
import { env } from '@/lib/env'
import { haptics } from '@/lib/haptics'

type CalendarFeedSheetProps = {
  open: boolean
  onClose: () => void
  tripId: string
}

const COPIED_RESET_MS = 1600
// Supabase serves the calendar-feed edge function on the same host as the API - env.supabaseUrl
// minus its protocol, shared by both the webcal:// (Subscribe) and https:// (Copy link) variants.
const FEED_HOST = env.supabaseUrl.replace(/^https?:\/\//, '')

function feedUrl(scheme: 'webcal' | 'https', token: string) {
  return `${scheme}://${FEED_HOST}/functions/v1/calendar-feed?token=${token}`
}

// Trip settings -> Calendar row: lets the signed-in member subscribe their calendar app to the
// trip's events via a per-member bearer-token ICS feed. The raw token only ever lives in this
// component's state (fetched via the create RPC on first open) - never persisted, never logged,
// matching the "shown once" contract of create_calendar_feed_token.
export function CalendarFeedSheet({ open, onClose, tripId }: CalendarFeedSheetProps) {
  const { t } = useTranslation()
  const createToken = useCreateCalendarFeedToken()
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Survives re-renders (mutation state changes, parent re-renders) so the create RPC - which
  // revokes any previous token - never double-fires for a single open.
  const requestedRef = useRef(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Forgets the token/copied state the moment `open` flips to false - a render-phase "adjusting
  // state when a prop changes" update (the same idiom BottomSheet itself uses for `mounted`),
  // rather than a setState call inside an effect body, which React Compiler flags as a likely
  // cascading-render footgun.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setToken(null)
      setCopied(false)
    }
  }

  function requestToken() {
    requestedRef.current = true
    createToken.mutate(tripId, {
      onSuccess: (raw) => setToken(raw),
      onError: (error) => {
        haptics.error()
        // Never surface a raw error (RLS/RPC messages aren't user copy) - the UI shows a fixed,
        // translated string; the detail goes to the dev console only.
        if (__DEV__) {
          console.warn('calendar feed token request failed', error)
        }
        // A failed regenerate may have already revoked the previous token server-side (create
        // revokes-then-creates atomically) - drop it from state so the UI falls back to the error
        // branch instead of leaving a possibly-dead link rendered as if it still worked.
        setToken(null)
      },
    })
  }

  useEffect(() => {
    if (!open) {
      requestedRef.current = false
      return
    }
    if (!requestedRef.current) {
      requestToken()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tripId])

  // Clear the "copied" reset timer if the sheet unmounts before it fires.
  useEffect(
    () => () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    },
    [],
  )

  function subscribe() {
    if (!token) {
      return
    }
    void Linking.openURL(feedUrl('webcal', token))
  }

  async function copyLink() {
    if (!token) {
      return
    }
    await Clipboard.setStringAsync(feedUrl('https', token))
    setCopied(true)
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS)
  }

  function confirmRegenerate() {
    haptics.warning()
    Alert.alert(
      t('tripForm.calendarRegenerateConfirmTitle'),
      t('tripForm.calendarRegenerateConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('tripForm.calendarRegenerate'), style: 'destructive', onPress: requestToken },
      ],
    )
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('tripForm.calendarTitle')}>
      <Text style={styles.body}>{t('tripForm.calendarBody')}</Text>
      {!token && createToken.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t('tripForm.calendarError')}</Text>
          <Button
            label={t('common.retry')}
            icon="refresh"
            variant="secondary"
            block={false}
            onPress={requestToken}
          />
        </View>
      ) : !token ? (
        <View style={styles.loading}>
          <Spinner />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            label={t('tripForm.calendarSubscribe')}
            icon="calendar-outline"
            disabled={createToken.isPending}
            onPress={subscribe}
          />
          <Button
            label={copied ? t('tripForm.calendarCopied') : t('tripForm.calendarCopy')}
            icon={copied ? 'checkmark' : 'copy-outline'}
            variant="secondary"
            disabled={createToken.isPending}
            onPress={() => void copyLink()}
          />
          <Button
            label={t('tripForm.calendarRegenerate')}
            icon="refresh-outline"
            variant="destructive"
            loading={createToken.isPending}
            onPress={confirmRegenerate}
          />
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
  actions: {
    gap: theme.gap(2),
  },
}))
