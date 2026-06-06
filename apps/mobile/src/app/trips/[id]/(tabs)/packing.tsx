import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import {
  Avatar,
  BottomSheet,
  EmptyState,
  ListRow,
  SectionTitle,
  Segmented,
  Spinner,
} from '@/components/ui'
import { useAuth } from '@/features/auth'
import { useTripMembers } from '@/features/group'
import {
  categoryIcon,
  groupByCategory,
  inferCategory,
  PACKING_CATEGORIES,
  type PackingCategory,
  type PackingItem,
  type PackingScope,
  type SuggestedItem,
  useAddPackingItem,
  useAddPackingItems,
  useDeletePackingItem,
  usePackingItems,
  useSuggestPacking,
  useUpdatePackingItem,
} from '@/features/packing'
import { useEvents } from '@/features/timeline'
import { useTrip } from '@/features/trips'
import { useTripWeather } from '@/features/weather'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

type Glyph = keyof typeof Ionicons.glyphMap

function tripDays(start: string | null, end: string | null): number | null {
  if (!start || !end) {
    return null
  }
  const ms = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

export default function PackingScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const { session } = useAuth()
  const userId = session?.user.id ?? ''

  const { data: trip } = useTrip(tripId)
  const { data: items, isLoading } = usePackingItems(tripId)
  const { data: members } = useTripMembers(tripId)
  const { data: weather } = useTripWeather(trip)
  const { data: events } = useEvents(tripId)

  const addItem = useAddPackingItem(tripId)
  const updateItem = useUpdatePackingItem(tripId)
  const deleteItem = useDeletePackingItem(tripId)
  const suggest = useSuggestPacking()
  const addMany = useAddPackingItems(tripId)

  const [scope, setScope] = useState<PackingScope>('shared')
  const [addOpen, setAddOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<PackingItem | null>(null)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<PackingCategory>('clothes')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [hint, setHint] = useState('')
  // Suggestion preview: the deduped suggestions + which ones are checked for adding.
  const [preview, setPreview] = useState<SuggestedItem[] | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())

  const nameById = useMemo(
    () => new Map((members ?? []).map((m) => [m.id, m.display_name ?? t('common.member')])),
    [members, t],
  )

  const scoped = useMemo(() => (items ?? []).filter((i) => i.scope === scope), [items, scope])
  const groups = useMemo(() => groupByCategory(scoped), [scoped])
  const packedCount = scoped.filter((i) => i.packed).length

  const weatherSummary = useMemo(() => {
    if (!weather?.days?.length) {
      return ''
    }
    const mins = weather.days.map((d) => d.tempMinC)
    const maxs = weather.days.map((d) => d.tempMaxC)
    return `${Math.min(...mins)}-${Math.max(...maxs)}°C`
  }, [weather])

  // Compact summary of the planned events, so the AI list matches the actual activities.
  const activities = useMemo(
    () =>
      (events ?? [])
        .slice(0, 20)
        .map((e) => `- [${e.type}] ${e.title}`)
        .join('\n'),
    [events],
  )

  function openAdd() {
    setLabel('')
    setCategory('clothes')
    setCategoryTouched(false)
    setQuantity(1)
    setAddOpen(true)
  }

  // Auto-categorise as the user types, unless they picked a category manually.
  function onLabelChange(text: string) {
    setLabel(text)
    if (!categoryTouched) {
      setCategory(inferCategory(text))
    }
  }

  async function submitAdd() {
    const trimmed = label.trim()
    if (!trimmed || !userId) {
      return
    }
    try {
      await addItem.mutateAsync({
        tripId,
        scope,
        ownerId: userId,
        label: trimmed,
        category,
        quantity,
      })
      setAddOpen(false)
    } catch (error) {
      Alert.alert(t('common.tryAgain'), error instanceof Error ? error.message : '')
    }
  }

  // Generate / gaps / refine all run a suggestion and open the preview sheet so the user picks.
  function runSuggest(mode: 'generate' | 'gaps', refine?: string) {
    if (!trip?.destination || !userId || isLoading || suggest.isPending) {
      return
    }
    haptics.light()
    suggest.mutate(
      {
        destination: trip.destination,
        days: tripDays(trip.start_date, trip.end_date),
        weather: weatherSummary,
        language: i18n.language === 'fr' ? 'fr' : 'en',
        activities,
        hint: refine,
        mode,
        existing: scoped.map((i) => ({ label: i.label })),
      },
      {
        onSuccess: (result) => {
          setHint('')
          if (result.length === 0) {
            Alert.alert(t('packing.generate'), t('packing.generatedNone'))
            return
          }
          setPreview(result)
          setPicked(new Set(result.map((_, index) => index)))
        },
        onError: (error) => {
          Alert.alert(
            t('packing.generateError'),
            error instanceof Error ? error.message : t('common.tryAgain'),
          )
        },
      },
    )
  }

  function togglePick(index: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function confirmPreview() {
    if (!preview || !userId) {
      return
    }
    const chosen = preview.filter((_, index) => picked.has(index))
    addMany.mutate(
      chosen.map((s) => ({
        tripId,
        scope,
        ownerId: userId,
        label: s.label,
        category: s.category as PackingCategory,
        quantity: s.quantity,
      })),
      {
        onSuccess: () => setPreview(null),
        onError: (error) =>
          Alert.alert(t('common.tryAgain'), error instanceof Error ? error.message : ''),
      },
    )
  }

  function assign(memberId: string | null) {
    if (!assignTarget) {
      return
    }
    updateItem.mutate({ id: assignTarget.id, patch: { assignedMember: memberId } })
    setAssignTarget(null)
  }

  const addButton = (
    <Pressable
      onPress={openAdd}
      accessibilityRole="button"
      accessibilityLabel={t('packing.addItem')}
      hitSlop={8}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Ionicons name="add" size={26} color={theme.colors.foreground} />
    </Pressable>
  )

  return (
    <Screen title={trip?.title} showBack scroll right={addButton}>
      <Segmented
        value={scope}
        onChange={(v) => {
          setScope(v as PackingScope)
          // Drop any open suggestion preview so picks can't land in the wrong list.
          setPreview(null)
          setPicked(new Set())
        }}
        options={[
          { value: 'shared', label: t('packing.shared') },
          { value: 'personal', label: t('packing.personal') },
        ]}
      />

      <View style={styles.toolbar}>
        <Text style={styles.progress}>
          {t('packing.progress', { packed: packedCount, total: scoped.length })}
        </Text>
        <View style={styles.toolbarActions}>
          <Button
            label={suggest.isPending ? t('packing.generating') : t('packing.generate')}
            icon="sparkles"
            variant="secondary"
            size="sm"
            block={false}
            disabled={!trip?.destination || isLoading || suggest.isPending}
            onPress={() => runSuggest('generate')}
          />
          <Button
            label={t('packing.gaps')}
            icon="search"
            variant="ghost"
            size="sm"
            block={false}
            disabled={!trip?.destination || isLoading || suggest.isPending}
            onPress={() => runSuggest('gaps')}
          />
        </View>
      </View>

      {trip?.destination ? (
        <View style={styles.refineRow}>
          <View style={styles.refineInput}>
            <TextField
              value={hint}
              onChangeText={setHint}
              placeholder={t('packing.refinePlaceholder')}
              autoCorrect={false}
            />
          </View>
          <Pressable
            onPress={() => runSuggest('generate', hint.trim() || undefined)}
            accessibilityRole="button"
            accessibilityLabel={t('packing.refine')}
            disabled={hint.trim().length === 0 || suggest.isPending}
            style={({ pressed }) => [
              styles.refineSend,
              { backgroundColor: theme.colors.primary },
              (hint.trim().length === 0 || suggest.isPending) && styles.refineSendOff,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="sparkles" size={18} color={theme.colors.primaryForeground} />
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <Spinner />
        </View>
      ) : scoped.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="bag-handle-outline"
            title={t('packing.emptyTitle')}
            body={t('packing.emptyBody')}
            cta={t('packing.addItem')}
            onCta={openAdd}
          />
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.category} style={styles.section}>
            <SectionTitle>{t(`packing.categories.${group.category}`)}</SectionTitle>
            <Animated.View entering={FadeIn.duration(250)}>
              {group.items.map((item, index) => {
                const assignedName = item.assigned_member
                  ? nameById.get(item.assigned_member)
                  : null
                const subtitleParts = [
                  item.quantity > 1 ? `x${item.quantity}` : null,
                  scope === 'shared' && assignedName
                    ? t('packing.broughtBy', { name: assignedName })
                    : null,
                ].filter(Boolean)
                return (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.duration(220).delay(Math.min(index, 6) * 35)}
                    layout={LinearTransition}
                  >
                    <ListRow
                      icon={(item.packed ? 'checkmark-circle' : 'ellipse-outline') as Glyph}
                      iconColor={item.packed ? theme.colors.success : theme.colors.muted}
                      title={item.label}
                      subtitle={subtitleParts.length > 0 ? subtitleParts.join(' · ') : undefined}
                      onPress={() => {
                        haptics.selection()
                        updateItem.mutate({ id: item.id, patch: { packed: !item.packed } })
                      }}
                      last={index === group.items.length - 1}
                      right={
                        <View style={styles.rowActions}>
                          {scope === 'shared' ? (
                            <Pressable
                              onPress={() => setAssignTarget(item)}
                              accessibilityRole="button"
                              accessibilityLabel={t('packing.assignTitle')}
                              hitSlop={6}
                              style={({ pressed }) => [pressed && styles.pressed]}
                            >
                              {assignedName ? (
                                <Avatar name={assignedName} size={26} />
                              ) : (
                                <Ionicons
                                  name="person-add-outline"
                                  size={20}
                                  color={theme.colors.muted}
                                />
                              )}
                            </Pressable>
                          ) : null}
                          <Pressable
                            onPress={() => deleteItem.mutate(item.id)}
                            accessibilityRole="button"
                            accessibilityLabel={t('packing.deleteItem')}
                            hitSlop={6}
                            style={({ pressed }) => [pressed && styles.pressed]}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color={theme.colors.destructive}
                            />
                          </Pressable>
                        </View>
                      }
                    />
                  </Animated.View>
                )
              })}
            </Animated.View>
          </View>
        ))
      )}

      <View style={styles.spacer} />

      {/* Add item */}
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={t('packing.addItem')}>
        <View style={styles.sheet}>
          <TextField
            label={t('packing.itemLabel')}
            value={label}
            onChangeText={onLabelChange}
            placeholder={t('packing.itemPlaceholder')}
            autoFocus
          />

          <View>
            <Text style={styles.fieldLabel}>{t('packing.category')}</Text>
            <View style={styles.chips}>
              {PACKING_CATEGORIES.map((c) => {
                const selected = c === category
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setCategoryTouched(true)
                      setCategory(c)
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? withAlpha(theme.colors.primary, 0.14)
                          : theme.colors.card,
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={categoryIcon(c) as Glyph}
                      size={15}
                      color={selected ? theme.colors.primary : theme.colors.muted}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? theme.colors.primary : theme.colors.foreground },
                      ]}
                    >
                      {t(`packing.categories.${c}`)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          <View style={styles.qtyRow}>
            <Text style={styles.fieldLabel}>{t('packing.quantity')}</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                accessibilityRole="button"
                accessibilityLabel="-"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <Ionicons name="remove" size={18} color={theme.colors.foreground} />
              </Pressable>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <Pressable
                onPress={() => setQuantity((q) => Math.min(99, q + 1))}
                accessibilityRole="button"
                accessibilityLabel="+"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={18} color={theme.colors.foreground} />
              </Pressable>
            </View>
          </View>

          <Button
            label={t('packing.add')}
            onPress={() => void submitAdd()}
            disabled={label.trim().length === 0 || addItem.isPending}
          />
        </View>
      </BottomSheet>

      {/* Assign a member (shared items) */}
      <BottomSheet
        open={assignTarget != null}
        onClose={() => setAssignTarget(null)}
        title={t('packing.assignTitle')}
      >
        <View style={styles.sheet}>
          <Pressable
            onPress={() => assign(null)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}
          >
            <Ionicons name="close-circle-outline" size={26} color={theme.colors.muted} />
            <Text style={styles.memberName}>{t('packing.unassigned')}</Text>
          </Pressable>
          {(members ?? []).map((m) => (
            <Pressable
              key={m.id}
              onPress={() => assign(m.id)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}
            >
              <Avatar name={m.display_name ?? t('common.member')} size={26} />
              <Text style={styles.memberName}>{m.display_name ?? t('common.member')}</Text>
              {assignTarget?.assigned_member === m.id ? (
                <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      {/* AI suggestions preview */}
      <BottomSheet
        open={preview != null}
        onClose={() => setPreview(null)}
        title={t('packing.previewTitle')}
      >
        <View style={styles.sheet}>
          <View>
            {(preview ?? []).map((s, index) => {
              const on = picked.has(index)
              return (
                <Pressable
                  key={`${s.label}-${index}`}
                  onPress={() => togglePick(index)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [styles.previewRow, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={on ? theme.colors.primary : theme.colors.muted}
                  />
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewLabel} numberOfLines={1}>
                      {s.label}
                      {s.quantity > 1 ? ` x${s.quantity}` : ''}
                    </Text>
                    {s.reason ? (
                      <Text style={styles.previewReason} numberOfLines={1}>
                        {s.reason}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={categoryIcon(s.category) as Glyph}
                    size={16}
                    color={theme.colors.muted}
                  />
                </Pressable>
              )
            })}
          </View>
          <Button
            label={t('packing.addSelected', { count: picked.size })}
            onPress={confirmPreview}
            disabled={picked.size === 0 || addMany.isPending}
          />
        </View>
      </BottomSheet>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(3),
    marginTop: theme.gap(3),
  },
  progress: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
  },
  refineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    marginTop: theme.gap(2),
  },
  refineInput: {
    flex: 1,
  },
  refineSend: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
  },
  refineSendOff: {
    opacity: 0.4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2.5),
  },
  previewInfo: {
    flex: 1,
    minWidth: 0,
    gap: theme.gap(0.5),
  },
  previewLabel: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  previewReason: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.gap(8),
  },
  emptyWrap: {
    marginTop: theme.gap(4),
  },
  section: {
    marginTop: theme.gap(3),
    gap: theme.gap(1),
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.92 }],
  },
  spacer: {
    height: FLOATING_TAB_BAR_CLEARANCE,
  },
  sheet: {
    gap: theme.gap(4),
  },
  fieldLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    marginBottom: theme.gap(2),
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  stepBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  qtyValue: {
    minWidth: 24,
    textAlign: 'center',
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2.5),
  },
  memberName: {
    flex: 1,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
}))
