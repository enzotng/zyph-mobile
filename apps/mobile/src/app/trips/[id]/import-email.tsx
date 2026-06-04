import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { Spinner } from '@/components/ui'
import { type ParsedEmailEvent, useParseEmail } from '@/features/smart-import'
import { eventTypeIcon, useCreateEvent } from '@/features/timeline'
import { paramString } from '@/lib/routing'

export default function ImportEmailScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const parseEmail = useParseEmail()
  const createEvent = useCreateEvent(tripId)

  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedEmailEvent | null>(null)
  const [editedTitle, setEditedTitle] = useState('')
  const [clipboardHint, setClipboardHint] = useState<string | null>(null)
  // Snapshot the clipboard once on mount so the banner does not re-appear after
  // the user dismisses or uses it.
  const checkedClipboardRef = useRef(false)

  useEffect(() => {
    if (checkedClipboardRef.current) {
      return
    }
    checkedClipboardRef.current = true
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
  }, [])

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
      setParsed(result.event)
      setEditedTitle(result.event.title ?? t('smartImport.defaultTitle'))
    } catch (error) {
      Alert.alert(
        t('smartImport.parseErrorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  async function onConfirm() {
    if (!parsed) {
      return
    }
    const title = editedTitle.trim() || parsed.title || t('smartImport.defaultTitle')
    const startsAt = parsed.startsAt ?? new Date().toISOString()
    const endsAt = parsed.endsAt ?? undefined
    try {
      await createEvent.mutateAsync({
        tripId,
        title,
        type: parsed.type,
        startsAt,
        endsAt,
        notes: parsed.notes ?? '',
        lat: parsed.location?.lat ?? undefined,
        lng: parsed.location?.lng ?? undefined,
        gateLocation:
          parsed.gateLocation &&
          typeof parsed.gateLocation.lat === 'number' &&
          typeof parsed.gateLocation.lng === 'number'
            ? {
                label: parsed.gateLocation.label,
                lat: parsed.gateLocation.lat,
                lng: parsed.gateLocation.lng,
              }
            : null,
      })
      router.back()
    } catch (error) {
      Alert.alert(
        t('smartImport.createErrorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  const confidencePct = parsed ? Math.round(parsed.confidence * 100) : 0

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

      {parsed ? (
        <View style={styles.previewCard}>
          <View style={styles.previewHead}>
            <Ionicons name={eventTypeIcon(parsed.type)} size={22} color={theme.colors.primary} />
            <Text style={styles.previewType}>{t(`smartImport.types.${parsed.type}`)}</Text>
            <View style={styles.confidencePill}>
              <Text style={styles.confidenceText}>
                {t('smartImport.confidence', { pct: confidencePct })}
              </Text>
            </View>
          </View>

          <TextInput
            style={styles.titleInput}
            value={editedTitle}
            onChangeText={setEditedTitle}
            placeholder={t('smartImport.titlePlaceholder')}
            placeholderTextColor={theme.colors.muted}
          />

          {parsed.startsAt ? (
            <PreviewRow icon="calendar-outline" label={formatDateTime(parsed.startsAt)} />
          ) : (
            <PreviewRow icon="calendar-outline" label={t('smartImport.noDate')} muted />
          )}
          {parsed.endsAt ? (
            <PreviewRow
              icon="time-outline"
              label={t('smartImport.endsAt', { date: formatDateTime(parsed.endsAt) })}
            />
          ) : null}
          {parsed.location?.name ? (
            <PreviewRow icon="location-outline" label={parsed.location.name} />
          ) : null}
          {parsed.gateLocation?.label ? (
            <PreviewRow icon="airplane-outline" label={parsed.gateLocation.label} />
          ) : null}
          {parsed.priceCents != null && parsed.currency ? (
            <PreviewRow
              icon="card-outline"
              label={`${(parsed.priceCents / 100).toFixed(2)} ${parsed.currency}`}
            />
          ) : null}
          {parsed.notes ? (
            <ScrollView style={styles.notesWrap}>
              <Text style={styles.notes}>{parsed.notes}</Text>
            </ScrollView>
          ) : null}

          <Button
            label={createEvent.isPending ? t('smartImport.adding') : t('smartImport.addToTrip')}
            onPress={onConfirm}
            disabled={createEvent.isPending}
          />
          <Pressable
            onPress={() => setParsed(null)}
            accessibilityRole="button"
            style={styles.discardBtn}
          >
            <Text style={styles.discardText}>{t('smartImport.discard')}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  )
}

function PreviewRow({
  icon,
  label,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  muted?: boolean
}) {
  const { theme } = useUnistyles()
  return (
    <View style={styles.row}>
      <Ionicons
        name={icon}
        size={18}
        color={muted ? theme.colors.muted : theme.colors.foreground}
      />
      <Text style={[styles.rowText, muted ? styles.muted : null]}>{label}</Text>
    </View>
  )
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
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
  muted: {
    color: theme.colors.muted,
  },
  previewCard: {
    gap: theme.gap(2),
    padding: theme.gap(4),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  previewType: {
    flex: 1,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '700',
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
    letterSpacing: 0.5,
  },
  confidencePill: {
    paddingHorizontal: theme.gap(2),
    paddingVertical: theme.gap(1),
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confidenceText: {
    fontFamily: theme.fonts.sans.semibold,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  titleInput: {
    fontFamily: theme.fonts.display.bold,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.foreground,
    paddingVertical: theme.gap(2),
    marginTop: theme.gap(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(1),
  },
  rowText: {
    flex: 1,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
  },
  notesWrap: {
    maxHeight: theme.gap(30),
    marginTop: theme.gap(2),
  },
  notes: {
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
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
