import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, TextInput, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { DateField } from '@/components/date-field'
import { MemberChips } from '@/components/member-chips'
import { Screen } from '@/components/screen'
import { Spinner } from '@/components/ui'
import { type TripMember, useTripMembers } from '@/features/group'
import {
  confidenceLevel,
  matchParticipants,
  type ParsedEmailEvent,
  useParseEmail,
} from '@/features/smart-import'
import { eventTypeIcon, useCreateEvents } from '@/features/timeline'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

// One editable preview per extracted event; `included` drives the batch. Module-scoped (rather
// than declared inside the screen) so `EventPreviewCard` below can type its props against it.
type PreviewEvent = {
  key: string
  source: ParsedEmailEvent
  included: boolean
  title: string
  startsAt: Date
  notes: string
  // Subset of active member ids this event concerns. [] means "everyone" - the same
  // convention `createEvents`/`trip_events.participants` use server-side.
  participantIds: string[]
}

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
        result.events.map((event, index) => ({
          key: `evt-${index}`,
          source: event,
          included: true,
          title: event.title ?? t('smartImport.defaultTitle'),
          startsAt: event.startsAt ? new Date(event.startsAt) : new Date(),
          notes: event.notes ?? '',
          participantIds: matchParticipants(event.participants, memberInputs),
        })),
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
    // Cap to the same limits the manual add-event form enforces (title 120, notes 500,
    // gate label 40) - the edge caps too, but this write path must not trust its input.
    const events = included.map((p) => {
      const gate = p.source.gateLocation
      return {
        title: (p.title.trim() || p.source.title || t('smartImport.defaultTitle')).slice(0, 120),
        type: p.source.type,
        startsAt: p.startsAt.toISOString(),
        // Drop a parsed end date that no longer follows the (possibly edited) start.
        endsAt: p.source.endsAt && new Date(p.source.endsAt) > p.startsAt ? p.source.endsAt : null,
        notes: p.notes.slice(0, 500) || undefined,
        lat: p.source.location?.lat ?? null,
        lng: p.source.location?.lng ?? null,
        placeId: null,
        locationName: p.source.location?.name.slice(0, 120) ?? null,
        endLocation: p.source.endLocation
          ? {
              name: p.source.endLocation.name.slice(0, 120),
              lat: p.source.endLocation.lat,
              lng: p.source.endLocation.lng,
            }
          : null,
        gateLocation:
          gate && typeof gate.lat === 'number' && typeof gate.lng === 'number'
            ? { label: gate.label.slice(0, 40), lat: gate.lat, lng: gate.lng }
            : null,
        // [] is the "everyone" sentinel client-side; the server column stores that as null.
        participants: p.participantIds.length === 0 ? null : p.participantIds,
      }
    })
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

function EventPreviewCard({
  preview,
  activeMembers,
  onPatch,
  onToggle,
}: {
  preview: PreviewEvent
  activeMembers: TripMember[]
  onPatch: (
    key: string,
    patch: Partial<Pick<PreviewEvent, 'title' | 'startsAt' | 'notes' | 'participantIds'>>,
  ) => void
  onToggle: (key: string) => void
}) {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const { source } = preview
  // MemberChips wants the resolved profile shape, not the raw trip_members row.
  const memberChipMembers = activeMembers.map((m) => ({
    userId: m.user_id,
    displayName: m.display_name,
    avatarUrl: m.avatar_url,
  }))

  const confidencePct = Math.round(source.confidence * 100)
  const level = confidenceLevel(source.confidence)
  const confidenceColor =
    level === 'high'
      ? theme.colors.success
      : level === 'medium'
        ? theme.colors.primary
        : theme.colors.destructive

  return (
    <View style={[styles.previewCard, !preview.included ? styles.cardExcluded : null]}>
      <View style={styles.previewHead}>
        <Ionicons name={eventTypeIcon(source.type)} size={22} color={theme.colors.primary} />
        <Text style={styles.previewType}>{t(`smartImport.types.${source.type}`)}</Text>
        <Text style={[styles.confidenceText, { color: confidenceColor }]}>
          {t('smartImport.confidence', { pct: confidencePct })}
        </Text>
        <Pressable
          onPress={() => {
            haptics.selection()
            onToggle(preview.key)
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: preview.included }}
          accessibilityLabel={preview.title || t('smartImport.defaultTitle')}
        >
          <Ionicons
            name={preview.included ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={preview.included ? theme.colors.primary : theme.colors.muted}
          />
        </Pressable>
      </View>

      <View style={styles.meterTrack}>
        <View
          style={[styles.meterFill, { flex: source.confidence, backgroundColor: confidenceColor }]}
        />
        <View style={{ flex: 1 - source.confidence }} />
      </View>

      {level === 'low' ? (
        <View style={styles.reviewBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.destructive} />
          <Text style={styles.reviewText}>{t('smartImport.reviewHint')}</Text>
        </View>
      ) : null}

      <TextInput
        style={styles.titleInput}
        value={preview.title}
        onChangeText={(title) => onPatch(preview.key, { title })}
        placeholder={t('smartImport.titlePlaceholder')}
        placeholderTextColor={theme.colors.muted}
      />

      <View style={styles.dateField}>
        <DateField
          label={t('smartImport.dateLabel')}
          value={preview.startsAt}
          onChange={(startsAt) => onPatch(preview.key, { startsAt })}
        />
      </View>
      {source.endsAt ? (
        <PreviewRow
          icon="time-outline"
          label={t('smartImport.endsAt', {
            date: formatDateTime(source.endsAt, i18n.language),
          })}
        />
      ) : null}
      {source.location?.name ? (
        <PreviewRow icon="location-outline" label={source.location.name} />
      ) : null}
      {source.endLocation?.name ? (
        <PreviewRow icon="flag-outline" label={source.endLocation.name} />
      ) : null}
      {source.gateLocation?.label ? (
        <PreviewRow icon="airplane-outline" label={source.gateLocation.label} />
      ) : null}
      {source.priceCents != null && source.currency ? (
        <PreviewRow
          icon="card-outline"
          label={`${(source.priceCents / 100).toFixed(2)} ${source.currency}`}
        />
      ) : null}
      <TextInput
        style={styles.notesInput}
        value={preview.notes}
        onChangeText={(notes) => onPatch(preview.key, { notes })}
        placeholder={t('smartImport.notesPlaceholder')}
        placeholderTextColor={theme.colors.muted}
        multiline
        textAlignVertical="top"
      />

      <MemberChips
        members={memberChipMembers}
        selected={preview.participantIds}
        onChange={(participantIds) => onPatch(preview.key, { participantIds })}
        label={t('smartImport.participantsLabel')}
      />
    </View>
  )
}

function formatDateTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
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
  cardExcluded: {
    opacity: 0.45,
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
  confidenceText: {
    fontFamily: theme.fonts.sans.semibold,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  meterTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  meterFill: {
    height: 6,
  },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
    paddingHorizontal: theme.gap(2.5),
    paddingVertical: theme.gap(2),
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.destructive, 0.1),
  },
  reviewText: {
    flex: 1,
    fontFamily: theme.fonts.sans.medium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.destructive,
  },
  dateField: {
    marginTop: theme.gap(1),
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
  notesInput: {
    minHeight: theme.gap(16),
    marginTop: theme.gap(2),
    padding: theme.gap(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
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
