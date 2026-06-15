import { Ionicons } from '@expo/vector-icons'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Avatar, BottomSheet, Spinner, Surface } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  amountToCents,
  buildAssignmentsByPosition,
  buildEqualAssignments,
  computeMemberTotalsCents,
  type DraftItem,
  draftFromItems,
  draftsToItems,
  draftTotalCents,
  everyDraftAmountValid,
  everyDraftLabelled,
  formatAmount,
  type ParsedItem,
  reindexAssignmentsAfterRemoval,
  type SmartSplitItem,
  useCreateExpenseWithItems,
  useExpense,
  useExpenseItemAssignments,
  useExpenseItems,
  useUpsertExpenseWithItems,
} from '@/features/expenses'
import { convertCents, crossRate, useFxRates } from '@/features/fx'
import { memberLabel, useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

const MAX_INLINE_CHIPS = 4

type AttributionMode = 'create' | 'edit'

type EditorProps = {
  tripId: string
  mode: AttributionMode
  // Manual entry (no OCR scan): the user builds the line items by hand, so there is no scanned
  // total to reconcile against - the items sum is the expense total.
  isManual: boolean
  expenseId: string | null
  items: SmartSplitItem[]
  totalCents: number
  expenseCurrency: string
  initialDescription: string
  // position → member ids already assigned (pre-fill when re-editing).
  initialAssignmentsByPosition: Record<number, string[]>
}

// Resolves the attribution editor inputs from one of two sources:
// - create mode: the OCR scan params handed over by add-expense (synchronous)
// - edit mode: the persisted expense + items + assignments (async, loaded here)
// then mounts the editor with concrete, ready data so its state is seeded
// synchronously (no async-to-state effect).
export default function AttributeExpenseScreen() {
  const { t } = useTranslation()
  const params = useGlobalSearchParams<{
    id: string
    items?: string
    amountCents?: string
    currency?: string
    description?: string
    expenseId?: string
    manual?: string
  }>()
  const tripId = paramString(params.id)
  const expenseId = paramString(params.expenseId)
  const isEdit = expenseId.length > 0
  const isManual = paramString(params.manual) === '1'

  const parsedItems = useMemo<ParsedItem[]>(() => {
    try {
      const raw = JSON.parse(paramString(params.items) || '[]')
      return Array.isArray(raw) ? raw : []
    } catch {
      return []
    }
  }, [params.items])

  const { data: expense, isLoading: expenseLoading } = useExpense(expenseId)
  const { data: itemRows, isLoading: itemsLoading } = useExpenseItems(expenseId)
  const { data: assignmentRows, isLoading: assignmentsLoading } =
    useExpenseItemAssignments(expenseId)

  if (isEdit) {
    if (
      expenseLoading ||
      itemsLoading ||
      assignmentsLoading ||
      !expense ||
      !itemRows ||
      !assignmentRows
    ) {
      return (
        <Screen title={t('smartSplit.editTitle')} showBack>
          <View style={styles.center}>
            <Spinner />
          </View>
        </Screen>
      )
    }
    // Re-key stored positions to a contiguous 0..n-1 range matching array order
    // (itemRows arrive sorted by position asc). The editor and
    // computeMemberTotalsCents treat position as the array index, so normalising
    // here keeps the two in lockstep even if stored positions ever go sparse.
    const normalizedRows = itemRows.map((row, index) => ({ ...row, position: index }))
    return (
      <AttributionEditor
        key={expenseId}
        tripId={tripId}
        mode="edit"
        isManual={false}
        expenseId={expenseId}
        items={normalizedRows.map((row) => ({
          label: row.label,
          amountCents: row.amount_cents,
          position: row.position,
        }))}
        totalCents={expense.amount_cents}
        expenseCurrency={expense.currency}
        initialDescription={expense.description}
        initialAssignmentsByPosition={buildAssignmentsByPosition(normalizedRows, assignmentRows)}
      />
    )
  }

  return (
    <AttributionEditor
      key="create"
      tripId={tripId}
      mode="create"
      isManual={isManual}
      expenseId={null}
      items={parsedItems.map((item, position) => ({
        label: item.label,
        amountCents: item.amountCents,
        position,
      }))}
      totalCents={Number.parseInt(paramString(params.amountCents) || '0', 10)}
      expenseCurrency={paramString(params.currency) || 'EUR'}
      initialDescription={paramString(params.description) || t('smartSplit.defaultDescription')}
      initialAssignmentsByPosition={{}}
    />
  )
}

function AttributionEditor({
  tripId,
  mode,
  isManual,
  expenseId,
  items,
  totalCents,
  expenseCurrency,
  initialDescription,
  initialAssignmentsByPosition,
}: EditorProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const { theme } = useUnistyles()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: trip } = useTrip(tripId)
  const { data: members } = useTripMembers(tripId)
  const { data: fx } = useFxRates()
  const createWithItems = useCreateExpenseWithItems(tripId)
  const upsertWithItems = useUpsertExpenseWithItems(tripId)

  // assignmentsByPosition[i] = set of member ids assigned to item i. Seeded from
  // the persisted assignments when re-editing, empty for a fresh scan.
  const [assignmentsByPosition, setAssignmentsByPosition] = useState<Record<number, Set<string>>>(
    () => {
      const init: Record<number, Set<string>> = {}
      for (const [pos, ids] of Object.entries(initialAssignmentsByPosition)) {
        init[Number.parseInt(pos, 10)] = new Set(ids)
      }
      return init
    },
  )
  const [description, setDescription] = useState(initialDescription)
  // Editable line items (label + decimal-string amount). The saved expense total is the
  // sum of these lines, so an OCR receipt whose lines do not match the printed total is
  // always saveable once the user has corrected or added lines. `id` is a stable React key
  // (position stays the assignment key); a counter mints ids for added lines.
  // Manual entry starts with a single blank line so the user has something to fill; the seed uses
  // id `d0`, so the id counter must start at 1 to avoid colliding with the next added line.
  const nextDraftId = useRef(items.length === 0 && isManual ? 1 : items.length)
  const [drafts, setDrafts] = useState<(DraftItem & { id: string })[]>(() => {
    const seeded = draftFromItems(items).map((draft, index) => ({ ...draft, id: `d${index}` }))
    if (seeded.length === 0 && isManual) {
      return [{ id: 'd0', label: '', amount: '' }]
    }
    return seeded
  })
  const [sheetOpenForPosition, setSheetOpenForPosition] = useState<number | null>(null)

  const editedItems = useMemo(() => draftsToItems(drafts), [drafts])
  const itemsTotal = useMemo(() => draftTotalCents(drafts), [drafts])
  const delta = itemsTotal - totalCents

  const assignments = useMemo(() => {
    const out: { position: number; memberId: string; share: number }[] = []
    for (const [posStr, set] of Object.entries(assignmentsByPosition)) {
      const position = Number.parseInt(posStr, 10)
      const memberIds = Array.from(set)
      if (memberIds.length === 0) continue
      out.push(...buildEqualAssignments([position], memberIds))
    }
    return out
  }, [assignmentsByPosition])

  const memberTotals = useMemo(
    () => computeMemberTotalsCents(editedItems, assignments),
    [editedItems, assignments],
  )

  const unassignedCount = useMemo(() => {
    let count = 0
    for (let i = 0; i < drafts.length; i++) {
      const set = assignmentsByPosition[i]
      if (!set || set.size === 0) count++
    }
    return count
  }, [drafts.length, assignmentsByPosition])

  const toggleAssignment = useCallback((position: number, memberId: string) => {
    haptics.selection()
    setAssignmentsByPosition((prev) => {
      const set = new Set(prev[position] ?? new Set<string>())
      if (set.has(memberId)) {
        set.delete(memberId)
      } else {
        set.add(memberId)
      }
      return { ...prev, [position]: set }
    })
  }, [])

  const nameFor = useCallback(
    (member: { user_id: string | null; display_name: string | null }) =>
      memberLabel(member, userId, { you: t('common.you'), fallback: t('common.member') }),
    [userId, t],
  )

  // Bulk shortcut for the common "everyone shared everything" receipt: assign all active members to
  // every line in one tap, leaving per-line edits as the exception instead of ~N x members taps.
  const assignEveryoneToAll = useCallback(() => {
    const allIds = (members ?? []).map((m) => m.id)
    if (allIds.length === 0) {
      return
    }
    setAssignmentsByPosition(() => {
      const next: Record<number, Set<string>> = {}
      for (let i = 0; i < drafts.length; i++) {
        next[i] = new Set(allIds)
      }
      return next
    })
  }, [members, drafts.length])

  function setLabel(index: number, label: string) {
    setDrafts((prev) => prev.map((draft, i) => (i === index ? { ...draft, label } : draft)))
  }

  function setAmount(index: number, amount: string) {
    setDrafts((prev) => prev.map((draft, i) => (i === index ? { ...draft, amount } : draft)))
  }

  function addLine() {
    const id = `d${nextDraftId.current}`
    nextDraftId.current += 1
    setDrafts((prev) => [...prev, { id, label: '', amount: '' }])
  }

  function addMissingLine() {
    const missing = totalCents - itemsTotal
    if (missing <= 0) {
      return
    }
    const id = `d${nextDraftId.current}`
    nextDraftId.current += 1
    setDrafts((prev) => [
      ...prev,
      { id, label: t('smartSplit.differenceLabel'), amount: (missing / 100).toFixed(2) },
    ])
  }

  function removeLine(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index))
    setAssignmentsByPosition((prev) => reindexAssignmentsAfterRemoval(prev, index))
  }

  // Stable inline-chip slice computed once, not per row.
  const inlineMembers = useMemo(() => (members ?? []).slice(0, MAX_INLINE_CHIPS), [members])
  const remainder = (members?.length ?? 0) - inlineMembers.length

  if (!trip || !members) {
    return (
      <Screen title={t('smartSplit.attribution')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (items.length === 0 && !isManual) {
    return (
      <Screen title={t('smartSplit.attribution')} showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>{t('smartSplit.noItems')}</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.link}>{t('smartSplit.goBack')}</Text>
          </Pressable>
        </View>
      </Screen>
    )
  }

  const tripCurrency = trip.currency
  const isForeign = expenseCurrency !== tripCurrency
  const fxRate = isForeign && fx ? crossRate(expenseCurrency, tripCurrency, fx.rates) : 1
  const canConvert = !isForeign || (fx && fx.rates[expenseCurrency] !== undefined)
  const baseAmountCents =
    isForeign && fx ? convertCents(itemsTotal, expenseCurrency, tripCurrency, fx.rates) : itemsTotal

  const currentUserMember = members.find((m) => m.user_id === userId)

  async function onSave() {
    if (!everyDraftLabelled(drafts)) {
      Alert.alert(t('smartSplit.emptyLabelTitle'), t('smartSplit.emptyLabelBody'))
      return
    }
    if (!everyDraftAmountValid(drafts)) {
      Alert.alert(t('smartSplit.invalidAmountTitle'), t('smartSplit.invalidAmountBody'))
      return
    }
    if (itemsTotal <= 0) {
      Alert.alert(t('smartSplit.zeroTotalTitle'), t('smartSplit.zeroTotalBody'))
      return
    }
    if (unassignedCount > 0) {
      Alert.alert(
        t('smartSplit.unassignedTitle'),
        t('smartSplit.unassignedBody', { count: unassignedCount }),
      )
      return
    }
    if (!currentUserMember) {
      Alert.alert(t('smartSplit.membershipErrorTitle'), t('smartSplit.membershipErrorBody'))
      return
    }
    if (isForeign && !canConvert) {
      Alert.alert(
        t('smartSplit.conversionFailed'),
        t('smartSplit.rateUnavailable', { currency: expenseCurrency }),
      )
      return
    }

    // Edit mode: the expense already exists, so a single atomic upsert replaces
    // its items + assignments + derived splits. The RPC runs in one transaction,
    // so a failure leaves the previous attribution intact - no rollback needed.
    if (mode === 'edit' && expenseId) {
      try {
        await upsertWithItems.mutateAsync({
          expenseId,
          description,
          amountCents: itemsTotal,
          currency: expenseCurrency,
          baseAmountCents,
          fxRate,
          items: editedItems,
          assignments,
        })
        haptics.success()
        router.back()
      } catch (error) {
        Alert.alert(
          t('smartSplit.saveError'),
          error instanceof Error ? error.message : t('common.tryAgain'),
        )
      }
      return
    }

    // Create mode: one atomic RPC inserts the expense + items + assignments + derived splits in a
    // single transaction, so a failure leaves nothing behind - no bootstrap, no orphan to clean up.
    try {
      await createWithItems.mutateAsync({
        tripId,
        description,
        amountCents: itemsTotal,
        currency: expenseCurrency,
        baseAmountCents,
        fxRate,
        items: editedItems,
        assignments,
      })
      haptics.success()
      router.replace({ pathname: '/trips/[id]/expenses', params: { id: tripId } })
    } catch (error) {
      Alert.alert(
        t('smartSplit.saveError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  const isPending = createWithItems.isPending || upsertWithItems.isPending
  const totalLabel = mode === 'edit' ? t('smartSplit.total') : t('smartSplit.ocrTotal')
  // OCR reconciliation (scanned total vs items sum, "add the difference") only makes sense when a
  // scan provided a target total - a manual split has none.
  const showAddMissing = mode === 'create' && !isManual && delta < 0

  return (
    <Screen title={mode === 'edit' ? t('smartSplit.editTitle') : t('smartSplit.title')} showBack>
      <View style={styles.descriptionField}>
        <TextField
          label={t('smartSplit.description')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('smartSplit.descriptionPlaceholder')}
        />
      </View>

      <Surface
        color={theme.colors.card}
        borderWidth={0}
        radius={theme.radius.lg}
        style={styles.header}
      >
        {isManual ? (
          <View style={styles.headerRow}>
            <Text style={styles.headerLabel}>{t('smartSplit.total')}</Text>
            <Text style={styles.headerValue}>{formatAmount(itemsTotal, expenseCurrency)}</Text>
          </View>
        ) : (
          <>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>{totalLabel}</Text>
              <Text style={styles.headerValue}>{formatAmount(totalCents, expenseCurrency)}</Text>
            </View>
            <View style={styles.headerRow}>
              <Text style={styles.headerLabel}>{t('smartSplit.itemsSum')}</Text>
              <Text
                style={[styles.headerValue, delta !== 0 ? { color: theme.colors.warning } : null]}
              >
                {formatAmount(itemsTotal, expenseCurrency)}
                {delta !== 0 ? `  (${delta > 0 ? '+' : ''}${(delta / 100).toFixed(2)})` : ''}
              </Text>
            </View>
          </>
        )}
      </Surface>

      <View style={styles.bulkRow}>
        <Button
          label={t('smartSplit.assignEveryone')}
          icon="people-outline"
          variant="secondary"
          size="sm"
          block={false}
          onPress={assignEveryoneToAll}
        />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {drafts.map((draft, index) => {
          const set = assignmentsByPosition[index] ?? new Set<string>()
          const isUnassigned = set.size === 0
          const lineCents = amountToCents(draft.amount)
          // Surface when a hidden (+N) member is assigned to this line, so the count is not silent.
          const extraSelected = members.slice(MAX_INLINE_CHIPS).some((m) => set.has(m.id))
          return (
            <Surface
              key={draft.id}
              color={theme.colors.card}
              borderColor={isUnassigned ? theme.colors.warning : theme.colors.border}
              borderWidth={1}
              radius={theme.radius.md}
              style={styles.itemCard}
            >
              <View style={styles.editRow}>
                <View style={styles.labelField}>
                  <TextField
                    value={draft.label}
                    onChangeText={(value) => setLabel(index, value)}
                    placeholder={t('smartSplit.itemLabelPlaceholder')}
                  />
                </View>
                <View style={styles.amountField}>
                  <TextField
                    value={draft.amount}
                    onChangeText={(value) => setAmount(index, value)}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                </View>
                <Pressable
                  onPress={() => removeLine(index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('smartSplit.removeLine')}
                  hitSlop={8}
                  style={styles.removeBtn}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.destructive} />
                </Pressable>
              </View>
              <View style={styles.chipsRow}>
                {inlineMembers.map((member) => (
                  <MemberChip
                    key={member.id}
                    name={nameFor(member)}
                    selected={set.has(member.id)}
                    onPress={() => toggleAssignment(index, member.id)}
                  />
                ))}
                {remainder > 0 ? (
                  <Pressable
                    onPress={() => setSheetOpenForPosition(index)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: extraSelected }}
                    accessibilityLabel={t('smartSplit.moreMembers', { count: remainder })}
                    style={[styles.moreChip, extraSelected && styles.moreChipActive]}
                  >
                    <Text style={[styles.moreChipText, extraSelected && styles.moreChipTextActive]}>
                      +{remainder}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {set.size > 1 ? (
                <Text style={styles.itemShared}>
                  {t('smartSplit.sharedBetween', {
                    count: set.size,
                    amount: formatAmount(lineCents / set.size, expenseCurrency),
                  })}
                </Text>
              ) : null}
            </Surface>
          )
        })}

        <View style={styles.addActions}>
          <Pressable
            onPress={addLine}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addLine, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={20} color={theme.colors.primary} />
            <Text style={styles.addLineText}>{t('smartSplit.addLine')}</Text>
          </Pressable>
          {showAddMissing ? (
            <Button
              label={t('smartSplit.addMissing', { amount: formatAmount(-delta, expenseCurrency) })}
              icon="git-compare-outline"
              variant="secondary"
              size="sm"
              block={false}
              onPress={addMissingLine}
            />
          ) : null}
        </View>

        <Text style={styles.tip}>{t('smartSplit.tip')}</Text>
      </ScrollView>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>
          {t('smartSplit.perPerson', { currency: tripCurrency })}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryRow}
        >
          {members.map((member) => {
            const expenseCentsForMember = memberTotals.get(member.id) ?? 0
            // Convert from expense currency to trip currency for the live preview.
            const cents =
              isForeign && fx
                ? convertCents(expenseCentsForMember, expenseCurrency, tripCurrency, fx.rates)
                : expenseCentsForMember
            return (
              <Surface
                key={member.id}
                color={theme.colors.card}
                borderColor={theme.colors.border}
                borderWidth={1}
                radius={theme.radius.md}
                style={styles.summaryPill}
              >
                <Text style={styles.summaryName}>{nameFor(member)}</Text>
                <Text style={styles.summaryValue}>{formatAmount(cents, tripCurrency)}</Text>
              </Surface>
            )
          })}
        </ScrollView>
        {unassignedCount > 0 ? (
          <Text style={styles.warn}>
            {t('smartSplit.unassignedCount', { count: unassignedCount })}
          </Text>
        ) : null}
        <Button
          label={
            isPending
              ? t('smartSplit.saving')
              : mode === 'edit'
                ? t('smartSplit.saveChanges')
                : t('smartSplit.save')
          }
          onPress={onSave}
          disabled={
            isPending || unassignedCount > 0 || itemsTotal <= 0 || (isForeign && !canConvert)
          }
        />
      </View>

      <BottomSheet
        open={sheetOpenForPosition !== null}
        onClose={() => setSheetOpenForPosition(null)}
        title={t('smartSplit.assignTo')}
      >
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList}>
          {members.map((member) => {
            if (sheetOpenForPosition === null) return null
            const set = assignmentsByPosition[sheetOpenForPosition] ?? new Set<string>()
            const selected = set.has(member.id)
            return (
              <Pressable
                key={member.id}
                style={styles.sheetRow}
                onPress={() => toggleAssignment(sheetOpenForPosition, member.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Ionicons
                  name={selected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={selected ? theme.colors.primary : theme.colors.muted}
                />
                <Avatar name={nameFor(member)} size={28} />
                <Text style={styles.sheetRowText}>{nameFor(member)}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
        <Button label={t('common.done')} onPress={() => setSheetOpenForPosition(null)} />
      </BottomSheet>
    </Screen>
  )
}

// A selectable member as a tinted Avatar (the deterministic tint disambiguates same-initial names
// like Alice/Anna, unlike a bare initial). Unselected is dimmed; selected gets a ring + check badge.
function MemberChip({
  name,
  selected,
  onPress,
}: {
  name: string
  selected: boolean
  onPress: () => void
}) {
  const { theme } = useUnistyles()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected }}
      style={[styles.chip, !selected && styles.chipDim]}
    >
      <Avatar name={name} size={44} ring={selected} />
      {selected ? (
        <View style={styles.chipCheck}>
          <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(2),
  },
  muted: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.sans.regular,
  },
  link: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
  },
  warn: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
    paddingVertical: theme.gap(1),
  },
  descriptionField: {
    paddingBottom: theme.gap(2),
  },
  header: {
    gap: theme.gap(1),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
    marginBottom: theme.gap(2),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLabel: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
  },
  headerValue: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: theme.gap(4),
  },
  itemCard: {
    gap: theme.gap(2),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
    marginBottom: theme.gap(2),
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  labelField: {
    flex: 1,
  },
  amountField: {
    width: theme.gap(22),
  },
  removeBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemShared: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.regular,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  chip: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipDim: {
    opacity: 0.4,
  },
  chipCheck: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderRadius: 9,
    backgroundColor: theme.colors.background,
  },
  moreChip: {
    paddingHorizontal: theme.gap(3),
    height: theme.gap(9),
    borderRadius: theme.gap(5),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  moreChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
  },
  moreChipText: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  moreChipTextActive: {
    color: theme.colors.primary,
  },
  bulkRow: {
    alignItems: 'flex-start',
    paddingBottom: theme.gap(2),
  },
  addActions: {
    gap: theme.gap(2),
    alignItems: 'flex-start',
    paddingVertical: theme.gap(2),
  },
  addLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2),
  },
  addLineText: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
  },
  tip: {
    color: theme.colors.muted,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    paddingVertical: theme.gap(2),
  },
  summary: {
    gap: theme.gap(2),
    paddingTop: theme.gap(3),
    paddingHorizontal: theme.gap(2),
  },
  summaryTitle: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '700',
  },
  summaryRow: {
    gap: theme.gap(2),
    paddingBottom: theme.gap(2),
  },
  summaryPill: {
    alignItems: 'center',
    paddingHorizontal: theme.gap(3),
    paddingVertical: theme.gap(2),
  },
  summaryName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  pressed: {
    opacity: 0.85,
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetList: {
    gap: theme.gap(2),
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(2),
  },
  sheetRowText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
    fontFamily: theme.fonts.sans.regular,
  },
}))
