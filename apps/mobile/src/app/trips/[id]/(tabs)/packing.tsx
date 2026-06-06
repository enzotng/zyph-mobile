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
  PACKING_CATEGORIES,
  type PackingCategory,
  type PackingItem,
  type PackingScope,
  useAddPackingItem,
  useDeletePackingItem,
  useGeneratePacking,
  usePackingItems,
  useUpdatePackingItem,
} from '@/features/packing'
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

  const addItem = useAddPackingItem(tripId)
  const updateItem = useUpdatePackingItem(tripId)
  const deleteItem = useDeletePackingItem(tripId)
  const generate = useGeneratePacking(tripId)

  const [scope, setScope] = useState<PackingScope>('shared')
  const [addOpen, setAddOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<PackingItem | null>(null)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<PackingCategory>('clothes')
  const [quantity, setQuantity] = useState(1)

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

  function resetAddForm() {
    setLabel('')
    setCategory('clothes')
    setQuantity(1)
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
      resetAddForm()
    } catch (error) {
      Alert.alert(t('common.tryAgain'), error instanceof Error ? error.message : '')
    }
  }

  function runGenerate() {
    // Wait for the list to load so dedupe runs against the full set (avoids re-adding existing items).
    if (!trip?.destination || !userId || isLoading || generate.isPending) {
      return
    }
    haptics.light()
    generate.mutate(
      {
        scope,
        ownerId: userId,
        destination: trip.destination,
        days: tripDays(trip.start_date, trip.end_date),
        weather: weatherSummary,
        language: i18n.language === 'fr' ? 'fr' : 'en',
        existing: scoped.map((i) => ({ label: i.label })),
      },
      {
        onSuccess: (count) => {
          const message =
            count === 0
              ? t('packing.generatedNone')
              : count === 1
                ? t('packing.generatedOne', { count })
                : t('packing.generatedOther', { count })
          Alert.alert(t('packing.generate'), message)
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

  function assign(memberId: string | null) {
    if (!assignTarget) {
      return
    }
    updateItem.mutate({ id: assignTarget.id, patch: { assignedMember: memberId } })
    setAssignTarget(null)
  }

  const addButton = (
    <Pressable
      onPress={() => setAddOpen(true)}
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
        onChange={(v) => setScope(v as PackingScope)}
        options={[
          { value: 'shared', label: t('packing.shared') },
          { value: 'personal', label: t('packing.personal') },
        ]}
      />

      <View style={styles.toolbar}>
        <Text style={styles.progress}>
          {t('packing.progress', { packed: packedCount, total: scoped.length })}
        </Text>
        <Button
          label={generate.isPending ? t('packing.generating') : t('packing.generate')}
          icon="sparkles"
          variant="secondary"
          size="sm"
          block={false}
          disabled={!trip?.destination || isLoading || generate.isPending}
          onPress={runGenerate}
        />
      </View>

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
            onCta={() => setAddOpen(true)}
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
            onChangeText={setLabel}
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
                    onPress={() => setCategory(c)}
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
