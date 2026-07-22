import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, TextInput, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { DateField } from '@/components/date-field'
import { MemberChips } from '@/components/member-chips'
import type { TripMember } from '@/features/group'
import { iconForCode, labelKeyForCode } from '@/features/taxonomy'
import type { NewItineraryEvent } from '@/features/timeline'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

import { confidenceLevel } from '../confidence'
import { matchParticipants } from '../participants'
import type { ParsedEmailEvent } from '../schemas'

// One editable preview per extracted event; `included` drives the batch. Shared by Smart Import
// and the inbox proposal review, which both edit-then-confirm the same parsed shape.
export type PreviewEvent = {
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

// Maps one parsed event to its editable preview, preselecting participants by matching the
// booking's passenger names against the trip's active members.
export function parsedToPreview(
  event: ParsedEmailEvent,
  index: number,
  memberInputs: { userId: string; displayName: string | null }[],
  defaultTitle: string,
): PreviewEvent {
  return {
    key: `evt-${index}`,
    source: event,
    included: true,
    title: event.title ?? defaultTitle,
    startsAt: event.startsAt ? new Date(event.startsAt) : new Date(),
    notes: event.notes ?? '',
    participantIds: matchParticipants(event.participants, memberInputs),
  }
}

// Confirm transformation: turns the (possibly edited) previews into the shape
// `useCreateEvents`/`validate_import_proposal` consume. `defaultTitle` is the last-resort title
// when both the edited field and the parsed source are empty (the user cleared the title box on
// an event the model never titled) - callers pass the same localized `t('smartImport.defaultTitle')`
// used to seed the preview in `parsedToPreview`, so a cleared title never regresses to English.
export function previewsToEvents(
  previews: PreviewEvent[],
  defaultTitle: string,
): NewItineraryEvent[] {
  // Cap to the same limits the manual add-event form enforces (title 120, notes 500,
  // gate label 40) - the edge caps too, but this write path must not trust its input.
  return previews.map((p) => {
    const gate = p.source.gateLocation
    return {
      title: (p.title.trim() || p.source.title || defaultTitle).slice(0, 120),
      category: p.source.category,
      subcategory: p.source.subcategory,
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

export function EventPreviewCard({
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
        <Ionicons
          name={iconForCode(source.category, source.subcategory)}
          size={22}
          color={theme.colors.primary}
        />
        <Text style={styles.previewType}>
          {t(labelKeyForCode(source.subcategory ?? source.category))}
        </Text>
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

const styles = StyleSheet.create((theme) => ({
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
}))
