import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, TextInput, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { Spinner } from '@/components/ui'
import { useTripMembers } from '@/features/group'
import {
  EventPreviewCard,
  type PreviewEvent,
  parsedToPreview,
  previewsToEvents,
  useParseEmail,
} from '@/features/smart-import'
import { useCreateEvents } from '@/features/timeline'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

export default function ImportEmailScreen() {
  const params = useGlobalSearchParams<{ id: string; prefilledText?: string }>()
  const tripId = paramString(params.id)
  // Pre-filled when arriving from an OS share (share-handler -> here).
  const prefilledText = paramString(params.prefilledText)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const parseEmail = useParseEmail()
  const createEvents = useCreateEvents()
  const members = useTripMembers(tripId)
  // Memoized on the query's own data reference: react-query keeps that reference stable across
  // unrelated re-renders (e.g. a keystroke in the editor above), so this stays a stable prop for
  // every EventPreviewCard instead of a fresh array (and a compiler cache-miss) every render.
  const activeMembers = useMemo(
    () => (members.data ?? []).filter((m) => m.status === 'active' && m.user_id),
    [members.data],
  )

  const [text, setText] = useState(prefilledText)
  // null = nothing parsed yet; [] = parse ran and found nothing (empty state).
  const [previews, setPreviews] = useState<PreviewEvent[] | null>(null)
  const [clipboardHint, setClipboardHint] = useState<string | null>(null)
  // Snapshot the clipboard once on mount so the banner does not re-appear after
  // the user dismisses or uses it.
  const checkedClipboardRef = useRef(false)

  useEffect(() => {
    if (checkedClipboardRef.current) {
      return
    }
    checkedClipboardRef.current = true
    // Arriving from an OS share already fills the editor - don't also surface the clipboard banner.
    if (prefilledText) {
      return
    }
    let cancelled = false
    Clipboard.getStringAsync()
      .then((value) => {
        if (cancelled) {
          return
        }
        if (looksLikeBookingEmail(value)) {
          setClipboardHint(value)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [prefilledText])

  function pasteClipboard() {
    if (clipboardHint) {
      setText(clipboardHint)
      setClipboardHint(null)
    }
  }

  async function onParse() {
    if (text.trim().length < 30) {
      Alert.alert(t('smartImport.tooShortTitle'), t('smartImport.tooShortBody'))
      return
    }
    try {
      const result = await parseEmail.mutateAsync(text)
      const memberInputs = activeMembers.map((m) => ({
        userId: m.user_id,
        displayName: m.display_name,
      }))
      setPreviews(
        result.events.map((event, index) =>
          parsedToPreview(event, index, memberInputs, t('smartImport.defaultTitle')),
        ),
      )
      haptics.success()
    } catch (error) {
      haptics.error()
      if (__DEV__) {
        console.warn('smart-import parse failed', error)
      }
      // Never surface a raw error (a ZodError.message is a JSON issues dump) - the
      // alert is user-facing, the detail goes to the dev console only.
      Alert.alert(t('smartImport.parseErrorTitle'), t('smartImport.parseErrorBody'))
    }
  }

  async function onConfirmAll() {
    if (!previews) {
      return
    }
    const included = previews.filter((p) => p.included)
    if (included.length === 0) {
      return
    }
    const events = previewsToEvents(included, t('smartImport.defaultTitle'))
    try {
      await createEvents.mutateAsync({ tripId, events })
      haptics.success()
      router.back()
    } catch (error) {
      haptics.error()
      Alert.alert(
        t('smartImport.createErrorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  // Key-argument handlers hoisted out of the .map: fresh per-card closures made every keystroke
  // re-render all N cards (the compiler cannot keep an element stable when its props change
  // identity); stable refs confine a keystroke to the one edited card.
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

  const includedCount = previews?.filter((p) => p.included).length ?? 0

  return (
    <Screen title={t('smartImport.title')} showBack scroll>
      <Text style={styles.lede}>{t('smartImport.lede')}</Text>

      {clipboardHint ? (
        <Pressable
          onPress={pasteClipboard}
          accessibilityRole="button"
          accessibilityLabel={t('smartImport.clipboardTitle')}
          style={styles.clipboardBanner}
        >
          <Ionicons name="clipboard-outline" size={18} color={theme.colors.primary} />
          <View style={styles.clipboardBannerInfo}>
            <Text style={styles.clipboardBannerTitle}>{t('smartImport.clipboardTitle')}</Text>
            <Text style={styles.clipboardBannerHint}>
              {t('smartImport.clipboardHint', { count: clipboardHint.length })}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={theme.colors.primary} />
        </Pressable>
      ) : null}

      <View style={styles.editorWrap}>
        <TextInput
          style={styles.editor}
          placeholder={t('smartImport.placeholder')}
          placeholderTextColor={theme.colors.muted}
          multiline
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
        />
      </View>

      <Button
        label={parseEmail.isPending ? t('smartImport.parsing') : t('smartImport.parse')}
        icon="sparkles"
        onPress={onParse}
        disabled={parseEmail.isPending}
      />

      {parseEmail.isPending ? <Spinner label={t('smartImport.talking')} /> : null}

      {previews && previews.length === 0 ? (
        <View style={styles.previewCard}>
          <Text style={styles.previewType}>{t('smartImport.noEventsTitle')}</Text>
          <Text style={styles.lede}>{t('smartImport.noEventsBody')}</Text>
        </View>
      ) : null}

      {previews && previews.length > 0 ? (
        <>
          {previews.map((preview) => (
            <EventPreviewCard
              key={preview.key}
              preview={preview}
              activeMembers={activeMembers}
              onToggle={togglePreview}
              onPatch={patchPreview}
            />
          ))}
          <Button
            label={
              createEvents.isPending
                ? t('smartImport.adding')
                : t('smartImport.addToTrip', { count: includedCount })
            }
            onPress={onConfirmAll}
            disabled={createEvents.isPending || includedCount === 0}
          />
          <Pressable
            onPress={() => setPreviews(null)}
            accessibilityRole="button"
            style={styles.discardBtn}
          >
            <Text style={styles.discardText}>{t('smartImport.discard')}</Text>
          </Pressable>
        </>
      ) : null}
    </Screen>
  )
}

const BOOKING_KEYWORDS = [
  'booking',
  'reservation',
  'réservation',
  'confirmation',
  'flight',
  'vol ',
  'hotel',
  'hôtel',
  'check-in',
  'arrival',
  'arrivée',
  'departure',
  'départ',
  'gate ',
  'terminal',
  'pnr',
  'e-ticket',
  'eticket',
  'itinerary',
  'itinéraire',
  'sncf',
  'airbnb',
  'expedia',
  'kayak',
  'eurostar',
]

function looksLikeBookingEmail(value: string): boolean {
  if (!value || value.length < 100) {
    return false
  }
  const lower = value.toLowerCase()
  let matches = 0
  for (const keyword of BOOKING_KEYWORDS) {
    if (lower.includes(keyword)) {
      matches++
      if (matches >= 2) {
        return true
      }
    }
  }
  return false
}

const styles = StyleSheet.create((theme) => ({
  lede: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
  },
  clipboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  clipboardBannerInfo: {
    flex: 1,
    gap: theme.gap(1),
  },
  clipboardBannerTitle: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  clipboardBannerHint: {
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
  },
  editorWrap: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    minHeight: theme.gap(40),
  },
  editor: {
    minHeight: theme.gap(40),
    padding: theme.gap(3),
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
  },
  previewCard: {
    gap: theme.gap(2),
    padding: theme.gap(4),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  previewType: {
    flex: 1,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '700',
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.5,
  },
  discardBtn: {
    alignSelf: 'center',
    paddingVertical: theme.gap(2),
  },
  discardText: {
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.muted,
    fontWeight: '600',
  },
}))
