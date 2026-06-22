import { Ionicons } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useGlobalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { TRIP_TAB_BAR_CLEARANCE } from '@/components/layout/trip-tab-bar'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import {
  Avatar,
  BottomSheet,
  Chip,
  EmptyState,
  ErrorState,
  Segmented,
  Skeleton,
  Surface,
} from '@/components/ui'
import { useAuth } from '@/features/auth'
import { formatAmount, toCents, useExpenses } from '@/features/expenses'
import { useTripMembers } from '@/features/group'
import {
  applyPackLight,
  assignCommunalRoundRobin,
  assignPackingItem,
  categoryIcon,
  duplicateSharedOwner,
  equalSplitCents,
  filterByTraveler,
  groupByCategory,
  groupReadiness,
  inferCategory,
  PACKING_CATEGORIES,
  type PackingCategory,
  type PackingItem,
  type PackingScope,
  packingQueryKey,
  type SuggestedItem,
  UNASSIGNED_FILTER,
  unassignedSharedCount,
  useAddPackingItem,
  useAddPackingItems,
  useAssignPackingItem,
  useClaimPackingItem,
  useDeletePackingItem,
  useDeletePackingItems,
  useExpensePackingItem,
  useNudgePackingItem,
  usePackingItems,
  useSuggestPacking,
  useUpdatePackingItem,
} from '@/features/packing'
import { useEvents } from '@/features/timeline'
import { useTrip } from '@/features/trips'
import { PlanSegmented } from '@/features/trips/components/plan-segmented'
import { forecastToPrompt, useTripWeather, WeatherCard } from '@/features/weather'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

type Glyph = keyof typeof Ionicons.glyphMap

// One-tap activity seeds shown when a trip has no planned events yet, so Zo can still build a
// relevant list. The hint is sent to the LLM (English is fine - it answers in the user locale);
// the label is localised via `packing.seeds.<key>`.
const ACTIVITY_SEEDS = [
  { key: 'beach', icon: 'sunny-outline', hint: 'beach holiday, swimming and sun' },
  { key: 'hike', icon: 'trail-sign-outline', hint: 'hiking and outdoors' },
  { key: 'city', icon: 'business-outline', hint: 'city break and sightseeing' },
  { key: 'business', icon: 'briefcase-outline', hint: 'business trip with meetings' },
  { key: 'ski', icon: 'snow-outline', hint: 'ski and snow, cold weather' },
  { key: 'festival', icon: 'musical-notes-outline', hint: 'festival and camping' },
] as const

const SKELETON_ROWS = [0, 1, 2, 3, 4]

// The readiness card sits on the ink bezel (dark in both themes), so its text/progress use
// fixed brand values rather than theme tokens: cream copy + the bright indigo accent that reads
// on ink. Cream doubles as the "all packed" fill.
const CREAM = '#F4F1E8'
const ACCENT_ON_INK = '#7C74F0'

function tripDays(start: string | null, end: string | null): number | null {
  if (!start || !end) {
    return null
  }
  const ms = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

// Loading placeholder shaped like the packing content (a title bar + a few rows), matching the
// pois/expenses skeletons so the load->list transition crossfades instead of snapping.
function PackingSkeleton() {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      style={styles.skeleton}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
    >
      <Skeleton width="40%" height={18} radius={theme.radius.sm} />
      {SKELETON_ROWS.map((row) => (
        <View key={row} style={styles.skeletonRow}>
          <Skeleton width={38} height={38} radius={theme.radius.md} />
          <View style={styles.skeletonText}>
            <Skeleton width="55%" height={15} radius={theme.radius.sm} />
            <Skeleton width="30%" height={12} radius={theme.radius.sm} />
          </View>
        </View>
      ))}
    </Animated.View>
  )
}

// The "Refine with Zo" input owns its own text state so typing never re-renders the packing
// list (which would reconcile every row on each keystroke).
const RefineField = memo(function RefineField({
  onSubmit,
  disabled,
  busy,
}: {
  onSubmit: (text: string) => void
  disabled: boolean
  busy: boolean
}) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const [value, setValue] = useState('')
  const off = value.trim().length === 0 || disabled || busy

  return (
    <View style={styles.refineRow}>
      <View style={styles.refineInput}>
        <TextField
          value={value}
          onChangeText={setValue}
          placeholder={t('packing.refinePlaceholder')}
          accessibilityLabel={t('packing.refine')}
          autoCorrect={false}
        />
      </View>
      <Pressable
        onPress={() => {
          if (!off) {
            onSubmit(value.trim())
            setValue('')
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={t('packing.refine')}
        disabled={off}
        style={({ pressed }) => [
          styles.refineSend,
          { backgroundColor: theme.colors.primary },
          off && styles.refineSendOff,
          pressed && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.primaryForeground} />
        ) : (
          <Ionicons name="sparkles" size={18} color={theme.colors.primaryForeground} />
        )}
      </Pressable>
    </View>
  )
})

// Ink readiness card: a linear progress bar + a big percentage on the bezel surface (the
// spec's conic ring is substituted by a bar + big % since react-native-svg is absent). Pure
// presentational - it reuses the counts the screen already computes.
function ReadinessBezel({
  percent,
  packed,
  total,
  unassigned,
}: {
  percent: number
  packed: number
  total: number
  unassigned: number
}) {
  const { t } = useTranslation()
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const done = clamped === 100 && unassigned === 0
  const title = done
    ? t('packing.readyAllPacked')
    : clamped >= 60
      ? t('packing.readyAlmost')
      : t('packing.readyKeepPacking')
  const subtitle = [
    t('packing.readyItems', { packed, total }),
    unassigned > 0 ? t('packing.readyUnassigned', { count: unassigned }) : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <View style={styles.bezel}>
      <View style={styles.bezelHead}>
        <View style={styles.bezelTextBlock}>
          <Text style={styles.bezelEyebrow}>{t('tabs.packing').toUpperCase()}</Text>
          <Text style={styles.bezelTitle}>{title}</Text>
          <Text style={styles.bezelSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.bezelPercent}>{`${clamped}%`}</Text>
      </View>
      <View style={styles.bezelTrack}>
        <View
          style={[
            styles.bezelFill,
            { width: `${clamped}%`, backgroundColor: done ? CREAM : ACCENT_ON_INK },
          ]}
        />
      </View>
    </View>
  )
}

// A single traveler-filter pill: accent-filled when active, a muted fill otherwise.
function TravelerPill({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.selection()
        onPress()
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.filterPill,
        active && styles.filterPillActive,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[styles.filterPillText, active && styles.filterPillTextActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export default function PackingScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const queryClient = useQueryClient()

  const { data: trip } = useTrip(tripId)
  const { data: items, isLoading, isError, refetch } = usePackingItems(tripId)
  const { data: members, refetch: refetchMembers } = useTripMembers(tripId)
  const { data: weather } = useTripWeather(trip)
  const { data: events } = useEvents(tripId)
  const { data: expenses } = useExpenses(tripId)

  const addItem = useAddPackingItem(tripId)
  const updateItem = useUpdatePackingItem(tripId)
  const deleteItem = useDeletePackingItem(tripId)
  const assignItem = useAssignPackingItem(tripId)
  const claimItem = useClaimPackingItem(tripId)
  const nudgeItem = useNudgePackingItem()
  const suggest = useSuggestPacking()
  const addMany = useAddPackingItems(tripId)
  const expenseItem = useExpensePackingItem(tripId)
  const deleteMany = useDeletePackingItems(tripId)

  const [scope, setScope] = useState<PackingScope>('shared')
  const [addOpen, setAddOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<PackingItem | null>(null)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<PackingCategory>('clothes')
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [packLight, setPackLight] = useState(false)
  // Which AI trigger is running, so only that control shows progress during the LLM call.
  const [busy, setBusy] = useState<string | null>(null)
  // The AI options panel is open by default while the list is empty (you need it to bootstrap),
  // and collapsible once items exist so the list isn't pushed below the fold.
  const [aiExpanded, setAiExpanded] = useState(false)
  // Suggestion preview: the deduped suggestions + which ones are checked for adding.
  const [preview, setPreview] = useState<SuggestedItem[] | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  // Traveler filter for the shared list: null = everyone, a member id, or UNASSIGNED_FILTER.
  const [travelerFilter, setTravelerFilter] = useState<string | null>(null)
  // Split-as-expense sheet: the shared item being split, the typed amount and who shares the cost.
  const [splitTarget, setSplitTarget] = useState<PackingItem | null>(null)
  const [splitAmount, setSplitAmount] = useState('')
  const [splitMembers, setSplitMembers] = useState<Set<string>>(new Set())
  // Ids of the items the last Zo batch added, so the whole batch can be undone in one tap.
  const [lastAdded, setLastAdded] = useState<string[]>([])
  // Focused only once the add sheet has slid up (see BottomSheet onOpened), so the keyboard
  // does not race the entrance.
  const addLabelRef = useRef<TextInput>(null)

  // Refetch on focus so a co-editor's assignment/claim shows up when you return to the tab
  // (the live 2-phone demo) without realtime.
  useFocusEffect(
    useCallback(() => {
      void refetch()
      void refetchMembers()
    }, [refetch, refetchMembers]),
  )

  const nameById = useMemo(
    () => new Map((members ?? []).map((m) => [m.id, m.display_name ?? t('common.member')])),
    [members, t],
  )
  // The caller's own member (assigned_member stores a member id, not a user id).
  const myMember = useMemo(
    () => (members ?? []).find((m) => m.user_id === userId),
    [members, userId],
  )
  // Live (non-deleted) expenses by id, so an item linked to a still-live expense shows a "paid"
  // badge - and one whose expense was deleted frees up to be split again.
  const expensesById = useMemo(() => new Map((expenses ?? []).map((e) => [e.id, e])), [expenses])

  const scoped = useMemo(() => (items ?? []).filter((i) => i.scope === scope), [items, scope])
  const packedCount = useMemo(() => scoped.filter((i) => i.packed).length, [scoped])

  // Group-readiness is computed from the FULL shared list (scoped), never the filtered view, so
  // filtering to one traveler can't make the group look "ready".
  const readiness = useMemo(() => groupReadiness(scoped), [scoped])
  const unassignedCount = useMemo(() => unassignedSharedCount(scoped), [scoped])

  // Drop a stale traveler filter (e.g. the member left) so the list never silently shows empty.
  const safeFilter = useMemo(() => {
    if (
      travelerFilter &&
      travelerFilter !== UNASSIGNED_FILTER &&
      !(members ?? []).some((m) => m.id === travelerFilter)
    ) {
      return null
    }
    return travelerFilter
  }, [travelerFilter, members])

  // The list is grouped from the FILTERED view; readiness above stays on the full list.
  const visible = useMemo(
    () => filterByTraveler(scoped, scope === 'shared' ? safeFilter : null),
    [scoped, safeFilter, scope],
  )
  const groups = useMemo(() => groupByCategory(visible), [visible])

  // Per-day forecast text for the LLM ("date condition max/min"), so Zo can justify items by the
  // actual day (e.g. "rain jacket - rain Tue") instead of reasoning from a flat min-max range.
  const weatherText = useMemo(() => forecastToPrompt(weather), [weather])

  // Compact summary of the planned events, so the AI list matches the actual activities.
  const activities = useMemo(
    () =>
      (events ?? [])
        .slice(0, 20)
        .map((e) => `- [${e.type}] ${e.title}`)
        .join('\n'),
    [events],
  )

  const hasDestination = Boolean(trip?.destination)
  const noEvents = (events ?? []).length === 0
  // Non-blocking warning if the item being typed already exists on the shared list (any owner).
  const dupOwner =
    scope === 'shared' && label.trim() ? duplicateSharedOwner(items ?? [], label, nameById) : null
  // Empty list -> always show the bootstrap controls; otherwise gate them behind the toggle.
  const showAiControls = aiExpanded || scoped.length === 0
  const aiBusy = suggest.isPending

  // Split sheet derived state, memoised so typing the amount doesn't rebuild the member list each
  // keystroke. toCents returns NaN for a partial/empty input, so guard before trusting the amount.
  // The per-member share preview sorts ids the way the server does (by member id) so the previewed
  // amounts match exactly what expense_packing_item charges - the last cent lands on the same person.
  const { splitCents, splitValid, selectedSplitIds, shareByMember } = useMemo(() => {
    const cents = toCents(splitAmount)
    const valid = Number.isFinite(cents) && cents > 0
    const ids = (members ?? []).filter((m) => splitMembers.has(m.id)).map((m) => m.id)
    const ordered = [...ids].sort()
    const shares = valid ? equalSplitCents(cents, ordered.length) : []
    return {
      splitCents: cents,
      splitValid: valid,
      selectedSplitIds: ids,
      shareByMember: new Map(ordered.map((id, index) => [id, shares[index] ?? 0])),
    }
  }, [splitAmount, members, splitMembers])

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

  // Generate / gaps / refine / seeds all run a suggestion and open the preview sheet. `source`
  // labels which control fired, so only it shows a busy state.
  function runSuggest(mode: 'generate' | 'gaps', source: string, refine?: string) {
    if (!trip?.destination || !userId || isLoading || suggest.isPending) {
      return
    }
    haptics.light()
    setBusy(source)
    // A new generation supersedes the previous batch's undo affordance.
    setLastAdded([])
    const days = tripDays(trip.start_date, trip.end_date)
    suggest.mutate(
      {
        destination: trip.destination,
        days,
        weather: weatherText,
        language: i18n.language === 'fr' ? 'fr' : 'en',
        activities,
        hint: refine,
        mode,
        existing: scoped.map((i) => ({ label: i.label })),
        travelers: members?.length ?? 1,
        shared: scope === 'shared',
        packLight,
      },
      {
        onSuccess: (suggestions) => {
          // Deterministic pack-light: guarantees repeat-wear caps even if the LLM over-suggests.
          const result = packLight ? applyPackLight(suggestions, days) : suggestions
          if (result.length === 0) {
            Alert.alert(
              t('packing.generate'),
              mode === 'gaps' ? t('packing.gapsComplete') : t('packing.generatedNone'),
            )
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
        onSettled: () => setBusy(null),
      },
    )
  }

  function togglePackLight() {
    setPackLight((v) => !v)
    // Drop a stale preview so its quantities can't bypass the new pack-light setting.
    setPreview(null)
    setPicked(new Set())
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

  function toggleAllPicks() {
    setPicked((prev) =>
      prev.size === (preview?.length ?? 0)
        ? new Set()
        : new Set((preview ?? []).map((_, index) => index)),
    )
  }

  function confirmPreview() {
    if (!preview || !userId) {
      return
    }
    const chosen = preview.filter((_, index) => picked.has(index))
    // On a shared list, round-robin Zo's communal items across the members so the group shares
    // the load. Personal lists and non-communal items stay unassigned.
    const memberIds = (members ?? []).map((m) => m.id)
    const assignments =
      scope === 'shared' ? assignCommunalRoundRobin(chosen, memberIds) : chosen.map(() => null)
    addMany.mutate(
      chosen.map((s, index) => ({
        tripId,
        scope,
        ownerId: userId,
        label: s.label,
        // Coerce an off-list LLM category to 'other' so the insert never fails the DB check.
        category: (PACKING_CATEGORIES as readonly string[]).includes(s.category)
          ? (s.category as PackingCategory)
          : 'other',
        quantity: s.quantity,
        assignedMember: assignments[index],
      })),
      {
        onSuccess: (created) => {
          haptics.success()
          setPreview(null)
          setLastAdded(created.map((item) => item.id))
        },
        onError: (error) =>
          Alert.alert(t('common.tryAgain'), error instanceof Error ? error.message : ''),
      },
    )
  }

  function assign(memberId: string | null) {
    if (!assignTarget) {
      return
    }
    // Through the RPC so the assignee gets a notification.
    assignItem.mutate(
      { itemId: assignTarget.id, memberId },
      {
        onError: (error) =>
          Alert.alert(t('common.tryAgain'), error instanceof Error ? error.message : ''),
      },
    )
    setAssignTarget(null)
  }

  function claim(item: PackingItem) {
    if (!myMember) {
      return
    }
    claimItem.mutate(item.id, {
      onSuccess: () => haptics.success(),
      onError: (error) =>
        Alert.alert(t('common.tryAgain'), error instanceof Error ? error.message : ''),
    })
  }

  function nudge(item: PackingItem) {
    const name = item.assigned_member
      ? (nameById.get(item.assigned_member) ?? t('common.member'))
      : t('common.member')
    nudgeItem.mutate(item.id, {
      onSuccess: () => {
        haptics.success()
        Alert.alert(t('packing.nudge'), t('packing.nudged', { name }))
      },
      onError: (error) =>
        Alert.alert(t('common.tryAgain'), error instanceof Error ? error.message : ''),
    })
  }

  // Round-robins the currently-unassigned shared items across the members. Awaits every assign
  // (each emits a notify), invalidates the list once, and only confirms on real success.
  async function splitAcrossGroup() {
    const memberIds = (members ?? []).map((m) => m.id)
    if (memberIds.length < 2) {
      return
    }
    const unassigned = scoped.filter((i) => !i.assigned_member)
    if (unassigned.length === 0) {
      return
    }
    haptics.light()
    try {
      await Promise.all(
        unassigned.map((item, index) =>
          assignPackingItem(item.id, memberIds[index % memberIds.length]),
        ),
      )
      await queryClient.invalidateQueries({ queryKey: packingQueryKey(tripId) })
      haptics.success()
      Alert.alert(t('packing.splitGroup'), t('packing.splitDone'))
    } catch (error) {
      Alert.alert(t('common.tryAgain'), error instanceof Error ? error.message : '')
    }
  }

  function confirmDelete(item: PackingItem) {
    Alert.alert(t('packing.deleteTitle'), t('packing.deleteBody', { label: item.label }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem.mutateAsync(item.id)
          } catch (error) {
            Alert.alert(
              t('packing.deleteError'),
              error instanceof Error ? error.message : t('common.tryAgain'),
            )
          }
        },
      },
    ])
  }

  function openSplit(item: PackingItem) {
    setSplitTarget(item)
    setSplitAmount('')
    setSplitMembers(new Set((members ?? []).map((m) => m.id)))
  }

  function toggleSplitMember(id: string) {
    setSplitMembers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Creates the shared expense (equal split) and links it to the item via the RPC.
  async function confirmSplit() {
    if (!splitTarget || !splitValid || selectedSplitIds.length === 0) {
      return
    }
    try {
      await expenseItem.mutateAsync({
        itemId: splitTarget.id,
        amountCents: splitCents,
        memberIds: selectedSplitIds,
      })
      haptics.success()
      setSplitTarget(null)
      Alert.alert(t('packing.splitExpense'), t('packing.splitExpenseDone'))
    } catch (error) {
      Alert.alert(t('common.tryAgain'), error instanceof Error ? error.message : '')
    }
  }

  // Deletes the whole batch the last Zo generation added.
  function undoLastAdded() {
    if (lastAdded.length === 0) {
      return
    }
    const ids = lastAdded
    setLastAdded([])
    deleteMany.mutate(ids, {
      onError: (error) =>
        Alert.alert(t('common.tryAgain'), error instanceof Error ? error.message : ''),
    })
  }

  const addButton = (
    <Pressable
      onPress={openAdd}
      accessibilityRole="button"
      accessibilityLabel={t('packing.addItem')}
      hitSlop={10}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Ionicons name="add" size={26} color={theme.colors.foreground} />
    </Pressable>
  )

  return (
    <Screen title={trip?.title} showBack scroll right={addButton}>
      <PlanSegmented active="packing" tripId={tripId} />

      <Segmented
        value={scope}
        onChange={(v) => {
          setScope(v as PackingScope)
          // Drop any open suggestion preview so picks can't land in the wrong list.
          setPreview(null)
          setPicked(new Set())
          setTravelerFilter(null)
          // The undo banner belongs to the list we are leaving.
          setLastAdded([])
        }}
        options={[
          { value: 'shared', label: t('packing.shared') },
          { value: 'personal', label: t('packing.personal') },
        ]}
      />

      {weather?.days?.length ? (
        <Animated.View entering={FadeInDown.duration(320)} layout={LinearTransition}>
          <WeatherCard weather={weather} />
        </Animated.View>
      ) : null}

      {hasDestination ? (
        <Animated.View entering={FadeInDown.duration(280).delay(40)} style={styles.aiZone}>
          <View style={styles.aiHeader}>
            <Text style={styles.progress}>
              {t('packing.progress', { packed: packedCount, total: scoped.length })}
            </Text>
            <View style={styles.aiHeaderActions}>
              <Button
                label={busy === 'generate' ? t('packing.generating') : t('packing.generate')}
                icon="sparkles"
                variant="secondary"
                size="sm"
                block={false}
                disabled={isLoading || aiBusy}
                onPress={() => runSuggest('generate', 'generate')}
              />
              <Button
                label={t('packing.gaps')}
                icon="search"
                variant="ghost"
                size="sm"
                block={false}
                disabled={isLoading || aiBusy || scoped.length === 0}
                onPress={() => runSuggest('gaps', 'gaps')}
              />
              {scoped.length > 0 ? (
                <Pressable
                  onPress={() => setAiExpanded((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={t('packing.aiOptions')}
                  accessibilityState={{ expanded: aiExpanded }}
                  hitSlop={10}
                  style={({ pressed }) => [styles.chevron, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={aiExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.muted}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>

          {showAiControls ? (
            <Animated.View
              entering={FadeInDown.duration(240)}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition}
              style={styles.aiControls}
            >
              <Chip
                label={t('packing.packLight')}
                icon="leaf-outline"
                selected={packLight}
                accessibilityLabel={`${t('packing.packLight')}. ${t('packing.packLightHint')}`}
                onPress={togglePackLight}
              />
              <Text style={styles.hint}>{t('packing.packLightHint')}</Text>

              <RefineField
                onSubmit={(text) => runSuggest('generate', 'refine', text)}
                disabled={isLoading || aiBusy}
                busy={busy === 'refine'}
              />

              {scope === 'shared' && scoped.length > 0 && (members?.length ?? 0) >= 2 ? (
                <Button
                  label={t('packing.splitGroup')}
                  icon="people-outline"
                  variant="ghost"
                  size="sm"
                  block={false}
                  onPress={() => void splitAcrossGroup()}
                />
              ) : null}

              {noEvents ? (
                <View style={styles.seedsBlock}>
                  <Text style={styles.hint}>{t('packing.seedsHint')}</Text>
                  <View style={styles.seeds}>
                    {ACTIVITY_SEEDS.map((seed) => (
                      <Chip
                        key={seed.key}
                        label={t(`packing.seeds.${seed.key}`)}
                        icon={seed.icon as Glyph}
                        selected={busy === `seed:${seed.key}`}
                        accessibilityLabel={t('packing.generateFor', {
                          activity: t(`packing.seeds.${seed.key}`),
                        })}
                        onPress={() => runSuggest('generate', `seed:${seed.key}`, seed.hint)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : (
        <Surface
          color={theme.colors.card}
          borderColor={theme.colors.border}
          borderWidth={1}
          radius={theme.radius.lg}
          style={styles.noDestination}
        >
          <Ionicons
            name="sparkles-outline"
            size={22}
            color={theme.colors.muted}
            importantForAccessibility="no"
          />
          <Text style={styles.noDestinationText}>{t('packing.needDestination')}</Text>
          <Button
            label={t('packing.editTrip')}
            variant="secondary"
            size="sm"
            block={false}
            onPress={() => router.push({ pathname: '/trips/[id]/edit', params: { id: tripId } })}
          />
        </Surface>
      )}

      {scope === 'shared' &&
      !isLoading &&
      !isError &&
      scoped.length > 0 &&
      (members?.length ?? 0) >= 1 ? (
        <Animated.View entering={FadeInDown.duration(280).delay(60)} layout={LinearTransition}>
          <ReadinessBezel
            percent={readiness.percent}
            packed={packedCount}
            total={scoped.length}
            unassigned={unassignedCount}
          />
        </Animated.View>
      ) : null}

      {scope === 'shared' && scoped.length > 0 && (members?.length ?? 0) >= 2 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TravelerPill
            label={t('packing.filterEveryone')}
            active={safeFilter === null}
            onPress={() => setTravelerFilter(null)}
          />
          {(members ?? []).map((m) => (
            <TravelerPill
              key={m.id}
              label={m.display_name ?? t('common.member')}
              active={safeFilter === m.id}
              onPress={() => setTravelerFilter(m.id)}
            />
          ))}
          <TravelerPill
            label={t('packing.filterUnassigned')}
            active={safeFilter === UNASSIGNED_FILTER}
            onPress={() => setTravelerFilter(UNASSIGNED_FILTER)}
          />
        </ScrollView>
      ) : null}

      {lastAdded.length > 0 ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOut.duration(160)}
          layout={LinearTransition}
        >
          <Surface
            color={theme.colors.card}
            borderColor={theme.colors.border}
            borderWidth={1}
            radius={theme.radius.lg}
            style={styles.undoBar}
          >
            <Text style={styles.undoText}>
              {t('packing.undoAdded', { count: lastAdded.length })}
            </Text>
            <View style={styles.undoActions}>
              <Pressable
                onPress={undoLastAdded}
                accessibilityRole="button"
                accessibilityLabel={t('packing.undo')}
                hitSlop={8}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text style={styles.undoBtn}>{t('packing.undo')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setLastAdded([])}
                accessibilityRole="button"
                accessibilityLabel={t('common.clear')}
                hitSlop={8}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Ionicons name="close" size={18} color={theme.colors.muted} />
              </Pressable>
            </View>
          </Surface>
        </Animated.View>
      ) : null}

      {isLoading ? (
        <PackingSkeleton />
      ) : isError ? (
        <Animated.View entering={FadeIn.duration(220)} style={styles.stateWrap}>
          <ErrorState
            icon="cloud-offline-outline"
            title={t('packing.loadErrorTitle')}
            body={t('packing.loadErrorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
          />
        </Animated.View>
      ) : scoped.length === 0 ? (
        <Animated.View entering={FadeIn.duration(220)} style={styles.stateWrap}>
          <EmptyState
            icon="bag-handle-outline"
            title={t('packing.emptyTitle')}
            body={t('packing.emptyBody')}
            cta={t('packing.addItem')}
            onCta={openAdd}
          />
        </Animated.View>
      ) : (
        groups.map((group) => (
          // Animated so removing the last item in a category fades the whole section out
          // instead of unmounting instantly (which would cut the row's own exit short).
          <Animated.View
            key={group.category}
            style={styles.section}
            exiting={FadeOut.duration(160)}
            layout={LinearTransition}
          >
            <Text style={styles.categoryTitle}>{t(`packing.categories.${group.category}`)}</Text>
            <Animated.View entering={FadeIn.duration(280)}>
              {group.items.map((item, index) => {
                const assignedName = item.assigned_member
                  ? nameById.get(item.assigned_member)
                  : null
                // Linked to a still-live expense -> the item is "paid"; a deleted one frees it.
                const paid = item.expense_id ? expensesById.get(item.expense_id) : null
                const subtitleParts = [
                  item.quantity > 1 ? `x${item.quantity}` : null,
                  scope === 'shared' && assignedName
                    ? t('packing.broughtBy', { name: assignedName })
                    : null,
                  scope === 'shared' && paid
                    ? t('packing.paidLabel', {
                        amount: formatAmount(
                          paid.base_amount_cents,
                          trip?.currency ?? paid.currency,
                        ),
                      })
                    : null,
                ].filter(Boolean)
                const subtitle = subtitleParts.length > 0 ? subtitleParts.join(', ') : null
                return (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.duration(220).delay(Math.min(index, 6) * 35)}
                    exiting={FadeOut.duration(160)}
                    layout={LinearTransition}
                  >
                    <View
                      style={[
                        styles.itemRow,
                        index === group.items.length - 1 && styles.itemRowLast,
                      ]}
                    >
                      <Pressable
                        onPress={() => {
                          haptics.selection()
                          updateItem.mutate({ id: item.id, patch: { packed: !item.packed } })
                        }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: item.packed }}
                        accessibilityLabel={item.label}
                        hitSlop={6}
                        style={({ pressed }) => [styles.itemMain, pressed && styles.pressed]}
                      >
                        <Ionicons
                          name={item.packed ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={item.packed ? theme.colors.success : theme.colors.muted}
                        />
                        <View style={styles.itemText}>
                          <Text
                            style={[styles.itemLabel, item.packed && styles.itemLabelPacked]}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          {subtitle ? (
                            <Text style={styles.itemSubtitle} numberOfLines={1}>
                              {subtitle}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>

                      <View style={styles.rowActions}>
                        {scope === 'shared' && !item.assigned_member && myMember ? (
                          <Chip
                            label={t('packing.claim')}
                            icon="hand-left-outline"
                            accessibilityLabel={`${t('packing.claim')}, ${item.label}`}
                            onPress={() => claim(item)}
                          />
                        ) : null}
                        {scope === 'shared' &&
                        item.assigned_member &&
                        item.assigned_member !== myMember?.id ? (
                          <Pressable
                            onPress={() => nudge(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('packing.nudge')}, ${item.label}`}
                            hitSlop={11}
                            style={({ pressed }) => [pressed && styles.pressed]}
                          >
                            <Ionicons
                              name="notifications-outline"
                              size={20}
                              color={theme.colors.muted}
                            />
                          </Pressable>
                        ) : null}
                        {scope === 'shared' ? (
                          <Pressable
                            onPress={() => setAssignTarget(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('packing.assignTitle')}, ${item.label}`}
                            hitSlop={11}
                            style={({ pressed }) => [pressed && styles.pressed]}
                          >
                            {assignedName ? (
                              <Avatar name={assignedName} size={26} />
                            ) : (
                              <View style={styles.unassignedPill}>
                                <Text style={styles.unassignedPillText}>
                                  {t('packing.filterUnassigned')}
                                </Text>
                              </View>
                            )}
                          </Pressable>
                        ) : null}
                        {scope === 'shared' && !paid ? (
                          <Pressable
                            onPress={() => openSplit(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('packing.splitExpense')}, ${item.label}`}
                            hitSlop={11}
                            style={({ pressed }) => [pressed && styles.pressed]}
                          >
                            <Ionicons name="cash-outline" size={20} color={theme.colors.muted} />
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => confirmDelete(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('packing.deleteItem')}, ${item.label}`}
                          hitSlop={11}
                          style={({ pressed }) => [pressed && styles.pressed]}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={theme.colors.destructive}
                          />
                        </Pressable>
                      </View>
                    </View>
                  </Animated.View>
                )
              })}
            </Animated.View>
          </Animated.View>
        ))
      )}

      <View style={styles.spacer} />

      {/* Add item */}
      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('packing.addItem')}
        onOpened={() => addLabelRef.current?.focus()}
      >
        <ScrollView
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.addLabelBlock}>
            <TextField
              ref={addLabelRef}
              label={t('packing.itemLabel')}
              value={label}
              onChangeText={onLabelChange}
              placeholder={t('packing.itemPlaceholder')}
            />
            {dupOwner ? (
              <View style={styles.dupWarn}>
                <Ionicons name="alert-circle-outline" size={15} color={theme.colors.destructive} />
                <Text style={styles.dupWarnText}>
                  {dupOwner.name
                    ? t('packing.dupWarning', { name: dupOwner.name, label: label.trim() })
                    : t('packing.dupWarningUnowned')}
                </Text>
              </View>
            ) : null}
          </View>

          <View>
            <Text style={styles.fieldLabel}>{t('packing.category')}</Text>
            <View style={styles.chips}>
              {PACKING_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={t(`packing.categories.${c}`)}
                  icon={categoryIcon(c) as Glyph}
                  selected={c === category}
                  onPress={() => {
                    setCategoryTouched(true)
                    setCategory(c)
                  }}
                />
              ))}
            </View>
          </View>

          <View style={styles.qtyRow}>
            <Text style={styles.fieldLabel}>{t('packing.quantity')}</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                accessibilityRole="button"
                accessibilityLabel={t('common.decrease')}
                style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              >
                <Ionicons name="remove" size={18} color={theme.colors.foreground} />
              </Pressable>
              <Text style={styles.qtyValue} accessibilityLabel={String(quantity)}>
                {quantity}
              </Text>
              <Pressable
                onPress={() => setQuantity((q) => Math.min(99, q + 1))}
                accessibilityRole="button"
                accessibilityLabel={t('common.increase')}
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
        </ScrollView>
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
          <Pressable
            onPress={toggleAllPicks}
            accessibilityRole="button"
            accessibilityLabel={
              picked.size === (preview?.length ?? 0) ? t('common.clear') : t('common.selectAll')
            }
            style={({ pressed }) => [styles.previewHeader, pressed && styles.pressed]}
          >
            <Text style={styles.previewCount}>
              {t('packing.addSelected', { count: picked.size })}
            </Text>
            <Text style={styles.previewToggle}>
              {picked.size === (preview?.length ?? 0) ? t('common.clear') : t('common.selectAll')}
            </Text>
          </Pressable>

          <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
            {(preview ?? []).map((s, index) => {
              const on = picked.has(index)
              return (
                <Animated.View
                  key={`${s.label}-${index}`}
                  entering={FadeInDown.duration(220).delay(Math.min(index, 8) * 30)}
                >
                  <Pressable
                    onPress={() => togglePick(index)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={s.label}
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
                      importantForAccessibility="no"
                    />
                  </Pressable>
                </Animated.View>
              )
            })}
          </ScrollView>

          <Button
            label={t('packing.addSelected', { count: picked.size })}
            onPress={confirmPreview}
            disabled={picked.size === 0 || addMany.isPending}
          />
        </View>
      </BottomSheet>

      {/* Split a shared item as a trip expense */}
      <BottomSheet
        open={splitTarget != null}
        onClose={() => setSplitTarget(null)}
        title={t('packing.splitExpense')}
      >
        <ScrollView
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.splitItemLabel}>{splitTarget?.label}</Text>
          <TextField
            label={t('packing.splitAmount')}
            value={splitAmount}
            onChangeText={setSplitAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />

          <View>
            <Text style={styles.fieldLabel}>{t('packing.splitWith')}</Text>
            {(members ?? []).map((m) => {
              const on = splitMembers.has(m.id)
              return (
                <Pressable
                  key={m.id}
                  onPress={() => toggleSplitMember(m.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={m.display_name ?? t('common.member')}
                  style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={on ? theme.colors.primary : theme.colors.muted}
                  />
                  <Avatar name={m.display_name ?? t('common.member')} size={26} />
                  <Text style={styles.memberName}>{m.display_name ?? t('common.member')}</Text>
                  {on && splitValid ? (
                    <Text style={styles.splitShare}>
                      {formatAmount(shareByMember.get(m.id) ?? 0, trip?.currency ?? 'EUR')}
                    </Text>
                  ) : null}
                </Pressable>
              )
            })}
          </View>

          <Button
            label={t('packing.splitConfirm')}
            onPress={() => void confirmSplit()}
            disabled={!splitValid || splitMembers.size === 0 || expenseItem.isPending}
          />
        </ScrollView>
      </BottomSheet>
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  aiZone: {
    gap: theme.gap(2.5),
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2),
  },
  aiHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
  },
  chevron: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  aiControls: {
    gap: theme.gap(2),
  },
  hint: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  refineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
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
    opacity: 0.5,
  },
  seedsBlock: {
    gap: theme.gap(2),
  },
  seeds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  noDestination: {
    alignItems: 'center',
    gap: theme.gap(2.5),
    paddingVertical: theme.gap(5),
    paddingHorizontal: theme.gap(4),
  },
  noDestinationText: {
    textAlign: 'center',
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    maxWidth: 260,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCount: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  previewToggle: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
  previewScroll: {
    maxHeight: rt.screen.height * 0.46,
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
  stateWrap: {
    marginTop: theme.gap(4),
  },
  skeleton: {
    gap: theme.gap(3),
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  skeletonText: {
    flex: 1,
    gap: theme.gap(1),
  },
  section: {
    gap: theme.gap(2),
  },
  categoryTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
    paddingTop: theme.gap(1),
  },
  bezel: {
    backgroundColor: theme.colors.bezel,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    paddingVertical: theme.gap(4),
    paddingHorizontal: theme.gap(4),
    gap: theme.gap(3),
  },
  bezelHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.gap(3),
  },
  bezelTextBlock: {
    flex: 1,
    gap: theme.gap(0.5),
  },
  bezelEyebrow: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.xs,
    letterSpacing: 1.2,
    color: withAlpha(CREAM, 0.6),
  },
  bezelTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: CREAM,
  },
  bezelSubtitle: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: withAlpha(CREAM, 0.7),
    marginTop: theme.gap(0.5),
  },
  bezelPercent: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xxl,
    color: CREAM,
  },
  bezelTrack: {
    height: 8,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
    backgroundColor: withAlpha(CREAM, 0.16),
  },
  bezelFill: {
    height: 8,
    borderRadius: theme.radius.full,
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.gap(2),
    paddingVertical: theme.gap(1),
  },
  filterPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3.5),
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.foreground, 0.06),
  },
  filterPillActive: {
    backgroundColor: theme.colors.primary,
  },
  filterPillText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  filterPillTextActive: {
    color: theme.colors.primaryForeground,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemRowLast: {
    borderBottomWidth: 0,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2),
  },
  itemText: {
    flex: 1,
    gap: theme.gap(0.5),
  },
  itemLabel: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  itemLabelPacked: {
    color: theme.colors.muted,
    textDecorationLine: 'line-through',
  },
  itemSubtitle: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  unassignedPill: {
    paddingVertical: theme.gap(1),
    paddingHorizontal: theme.gap(2),
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.warning, 0.14),
  },
  unassignedPillText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.xs,
    color: theme.colors.warning,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  spacer: {
    height: TRIP_TAB_BAR_CLEARANCE,
  },
  sheet: {
    gap: theme.gap(4),
  },
  addLabelBlock: {
    gap: theme.gap(1.5),
  },
  dupWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
  },
  dupWarnText: {
    flex: 1,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.destructive,
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
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2.5),
    paddingHorizontal: theme.gap(3),
  },
  undoText: {
    flex: 1,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  undoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  undoBtn: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
  splitItemLabel: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  splitShare: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
}))
