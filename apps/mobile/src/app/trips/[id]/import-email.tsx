import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { type ParsedEmailEvent, useParseEmail } from '@/features/smart-import'
import { useCreateEvent } from '@/features/timeline'
import { paramString } from '@/lib/routing'

const PLACEHOLDER = `Paste your booking confirmation here, e.g.

Air France e-Ticket
Flight AF1234
Paris CDG → New York JFK
Departure: March 15, 2026 at 14:30
Arrival: March 15, 2026 at 17:45
Terminal 2E · Gate 24B
Booking reference: AB12CD`

export default function ImportEmailScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
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
    if (checkedClipboardRef.current) return
    checkedClipboardRef.current = true
    let cancelled = false
    Clipboard.getStringAsync()
      .then((value) => {
        if (cancelled) return
        if (looksLikeBookingEmail(value)) {
          setClipboardHint(value)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  function useClipboardContent() {
    if (clipboardHint) {
      setText(clipboardHint)
      setClipboardHint(null)
    }
  }

  async function onParse() {
    if (text.trim().length < 30) {
      Alert.alert('Too short', 'Paste at least the key details of the confirmation email.')
      return
    }
    try {
      const result = await parseEmail.mutateAsync(text)
      setParsed(result.event)
      setEditedTitle(result.event.title ?? 'Imported event')
    } catch (error) {
      Alert.alert(
        'Could not parse the email',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  async function onConfirm() {
    if (!parsed) return
    const title = editedTitle.trim() || parsed.title || 'Imported event'
    const startsAt = parsed.startsAt ?? new Date().toISOString()
    const endsAt = parsed.endsAt ?? undefined
    try {
      await createEvent.mutateAsync({
        tripId,
        title,
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
      router.replace({ pathname: '/trips/[id]', params: { id: tripId } })
    } catch (error) {
      Alert.alert(
        'Could not create event',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  const confidencePct = parsed ? Math.round(parsed.confidence * 100) : 0

  return (
    <Screen title="Smart Import" showBack scroll>
      <Text style={styles.lede}>
        Paste a flight, hotel or train confirmation email. AI extracts the event details in seconds.
      </Text>

      {clipboardHint ? (
        <Pressable
          onPress={useClipboardContent}
          accessibilityRole="button"
          style={styles.clipboardBanner}
        >
          <Ionicons name="clipboard-outline" size={18} color={theme.colors.primary} />
          <View style={styles.clipboardBannerInfo}>
            <Text style={styles.clipboardBannerTitle}>Booking text detected in clipboard</Text>
            <Text style={styles.clipboardBannerHint}>
              Tap to paste {clipboardHint.length} chars
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={theme.colors.primary} />
        </Pressable>
      ) : null}

      <View style={styles.editorWrap}>
        <TextInput
          style={styles.editor}
          placeholder={PLACEHOLDER}
          placeholderTextColor={theme.colors.muted}
          multiline
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
        />
      </View>

      <Button
        label={parseEmail.isPending ? 'Parsing…' : 'Parse with AI'}
        onPress={onParse}
        disabled={parseEmail.isPending}
      />

      {parseEmail.isPending ? (
        <View style={styles.spinner}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.muted}>Talking to the model…</Text>
        </View>
      ) : null}

      {parsed ? (
        <View style={styles.previewCard}>
          <View style={styles.previewHead}>
            <Ionicons name={iconForType(parsed.type)} size={22} color={theme.colors.primary} />
            <Text style={styles.previewType}>{parsed.type.toUpperCase()}</Text>
            <View style={styles.confidencePill}>
              <Text style={styles.confidenceText}>{confidencePct}% confident</Text>
            </View>
          </View>

          <TextInput
            style={styles.titleInput}
            value={editedTitle}
            onChangeText={setEditedTitle}
            placeholder="Title"
            placeholderTextColor={theme.colors.muted}
          />

          {parsed.startsAt ? (
            <Row icon="calendar-outline" label={formatDateTime(parsed.startsAt)} />
          ) : (
            <Row icon="calendar-outline" label="No date detected" muted />
          )}
          {parsed.endsAt ? (
            <Row icon="time-outline" label={`Ends ${formatDateTime(parsed.endsAt)}`} />
          ) : null}
          {parsed.location?.name ? (
            <Row icon="location-outline" label={parsed.location.name} />
          ) : null}
          {parsed.gateLocation?.label ? (
            <Row icon="airplane-outline" label={parsed.gateLocation.label} />
          ) : null}
          {parsed.priceCents != null && parsed.currency ? (
            <Row
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
            label={createEvent.isPending ? 'Adding…' : 'Add to trip'}
            onPress={onConfirm}
            disabled={createEvent.isPending}
          />
          <Pressable
            onPress={() => setParsed(null)}
            accessibilityRole="button"
            style={styles.discardBtn}
          >
            <Text style={styles.discardText}>Discard and edit text</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  )
}

function Row({
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

function iconForType(type: ParsedEmailEvent['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'flight':
      return 'airplane'
    case 'hotel':
      return 'bed'
    case 'transport':
      return 'train'
    case 'activity':
      return 'sparkles'
    default:
      return 'calendar'
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString()
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
    color: theme.colors.foreground,
    fontWeight: '700',
  },
  clipboardBannerHint: {
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
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
  },
  spinner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2),
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
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  titleInput: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.foreground,
    paddingVertical: theme.gap(2),
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
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
  },
  notesWrap: {
    maxHeight: theme.gap(30),
    marginTop: theme.gap(2),
  },
  notes: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
  },
  discardBtn: {
    alignSelf: 'center',
    paddingVertical: theme.gap(2),
  },
  discardText: {
    color: theme.colors.muted,
    fontWeight: '600',
  },
}))
