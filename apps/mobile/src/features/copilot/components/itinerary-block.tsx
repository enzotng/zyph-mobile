import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { TaxonomyCategoryPicker } from '@/components/taxonomy-category-picker'
import { TextField } from '@/components/text-field'
import { Surface } from '@/components/ui'
import { type Poi, usePoiPhoto } from '@/features/places'
import { type NewItineraryEvent } from '@/features/timeline'
import { withAlpha } from '@/lib/color'

import type { ItineraryBlock as ItineraryBlockData } from '../schemas'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EditItem = {
  id: string
  date: string
  included: boolean
  title: string
  time: string
  category: string
  subcategory: string | null
  placeId: string
  notes: string
}

type ItineraryBlockProps = {
  block: ItineraryBlockData
  candidates: Poi[]
  onAdd: (events: NewItineraryEvent[]) => void
  onRegenerate: () => void
  isAdding?: boolean
  added?: boolean
}

// ---------------------------------------------------------------------------
// Child: ItineraryItemCard (calls usePoiPhoto at its top level — never inside a map)
// ---------------------------------------------------------------------------

type ItemCardProps = {
  item: EditItem
  poi: Poi | undefined
  onToggle: () => void
  onChange: (
    patch: Partial<Pick<EditItem, 'title' | 'time' | 'category' | 'subcategory' | 'notes'>>,
  ) => void
}

function ItineraryItemCard({ item, poi, onToggle, onChange }: ItemCardProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { data: photoUri } = usePoiPhoto(poi?.photoName ?? null)

  return (
    <View style={styles.card}>
      {/* Toggle is always interactive, outside the dimmed body */}
      <View style={styles.cardRow}>
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.included }}
          testID={`toggle-${item.id}`}
          style={styles.toggle}
        >
          <Ionicons
            name={item.included ? 'checkbox' : 'square-outline'}
            size={24}
            color={item.included ? theme.colors.primary : theme.colors.muted}
          />
        </Pressable>

        {/* Card body dims when excluded, but toggle stays active above */}
        <View style={[styles.cardBody, !item.included && styles.cardBodyDimmed]}>
          {/* Photo */}
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
          ) : (
            <Surface
              radius={theme.radius.md}
              borderColor={theme.colors.border}
              borderWidth={1}
              style={styles.photoPlaceholder}
            />
          )}

          {/* Editable fields */}
          <View style={styles.fields}>
            <TextField
              label={t('itinerary.titleLabel')}
              value={item.title}
              onChangeText={(v) => onChange({ title: v })}
            />
            <TextField
              label={t('itinerary.timeLabel')}
              value={item.time}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              onChangeText={(v) => onChange({ time: v })}
            />
            <TaxonomyCategoryPicker
              label={t('itinerary.typeLabel')}
              flag="events"
              category={item.category}
              subcategory={item.subcategory}
              onChange={({ category, subcategory }) =>
                onChange({ category: category ?? 'other', subcategory })
              }
            />

            {/* Meta row: rating, price level, open/closed (all conditional on poi + field) */}
            {poi ? (
              <View style={styles.metaRow}>
                {poi.rating !== null ? (
                  <Text style={styles.metaText}>{`★ ${poi.rating}`}</Text>
                ) : null}
                {poi.priceLevel !== null ? (
                  <Text style={styles.metaText}>{'$'.repeat(poi.priceLevel + 1)}</Text>
                ) : null}
                {poi.openNow !== null ? (
                  <Text
                    style={[styles.metaText, poi.openNow ? styles.metaOpen : styles.metaClosed]}
                  >
                    {poi.openNow ? t('itinerary.open') : t('itinerary.closed')}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Parent: ItineraryBlock (owns editable working state)
// ---------------------------------------------------------------------------

export function ItineraryBlock({
  block,
  candidates,
  onAdd,
  onRegenerate,
  isAdding = false,
  added = false,
}: ItineraryBlockProps): React.JSX.Element {
  const { t } = useTranslation()

  // Build flat working state once from the stable block prop.
  const [items, setItems] = useState<EditItem[]>(() =>
    block.days.flatMap((d, di) =>
      d.items.map((it, ii) => ({
        id: `${di}:${ii}`,
        date: d.date,
        included: true,
        title: it.title,
        time: it.time ?? '12:00',
        category: it.category,
        subcategory: it.subcategory,
        placeId: it.placeId,
        notes: it.notes ?? '',
      })),
    ),
  )

  const poiById = useMemo(() => new Map(candidates.map((c) => [c.placeId, c])), [candidates])

  const setIncluded = (id: string, value: boolean) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, included: value } : item)))
  }

  const patchItem = (
    id: string,
    patch: Partial<Pick<EditItem, 'title' | 'time' | 'category' | 'subcategory' | 'notes'>>,
  ) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  // Derive day groups for the day headers (preserve order).
  const dayGroups = useMemo(() => {
    const groups: { date: string; items: EditItem[] }[] = []
    for (const item of items) {
      const last = groups[groups.length - 1]
      if (last && last.date === item.date) {
        last.items.push(item)
      } else {
        groups.push({ date: item.date, items: [item] })
      }
    }
    return groups
  }, [items])

  const hasIncluded = items.some((i) => i.included)

  const handleAdd = () => {
    const events: NewItineraryEvent[] = items
      .filter((i) => i.included)
      .map((i) => ({
        title: i.title,
        category: i.category,
        subcategory: i.subcategory,
        startsAt: new Date(`${i.date}T${i.time || '12:00'}:00`).toISOString(),
        lat: poiById.get(i.placeId)?.lat ?? null,
        lng: poiById.get(i.placeId)?.lng ?? null,
        placeId: i.placeId,
        notes: i.notes || undefined,
      }))
    onAdd(events)
  }

  return (
    <View style={styles.root}>
      {dayGroups.map((group) => (
        <View key={group.date} style={styles.dayGroup}>
          <Text style={styles.dayHeader}>{group.date}</Text>
          {group.items.map((item) => (
            <ItineraryItemCard
              key={item.id}
              item={item}
              poi={poiById.get(item.placeId)}
              onToggle={() => setIncluded(item.id, !item.included)}
              onChange={(patch) => patchItem(item.id, patch)}
            />
          ))}
        </View>
      ))}

      {/* Footer actions */}
      <View style={styles.footer}>
        <Button label={t('itinerary.regenerate')} variant="secondary" onPress={onRegenerate} />
        <Button
          label={added ? t('itinerary.added') : t('itinerary.add')}
          variant="primary"
          disabled={!hasIncluded || added}
          loading={isAdding}
          onPress={handleAdd}
        />
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.gap(3),
  },
  dayGroup: {
    gap: theme.gap(2),
  },
  dayHeader: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  toggle: {
    padding: theme.gap(3),
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: theme.gap(2),
    paddingTop: theme.gap(3),
    paddingRight: theme.gap(3),
    paddingBottom: theme.gap(3),
  },
  cardBodyDimmed: {
    opacity: 0.5,
  },
  photo: {
    width: '100%',
    height: 120,
    borderRadius: theme.radius.md,
  },
  photoPlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: withAlpha(theme.colors.muted, 0.1),
  },
  fields: {
    gap: theme.gap(2),
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
    alignItems: 'center',
  },
  metaText: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
  },
  metaOpen: {
    color: theme.colors.success,
  },
  metaClosed: {
    color: theme.colors.destructive,
  },
  footer: {
    gap: theme.gap(2),
  },
}))
