import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { BottomSheet, Squircle } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  buildAssignmentsByPosition,
  buildEqualAssignments,
  computeMemberTotalsCents,
  deleteExpense,
  formatAmount,
  type ParsedItem,
  type SmartSplitItem,
  useCreateExpense,
  useExpense,
  useExpenseItemAssignments,
  useExpenseItems,
  useUpsertExpenseWithItems,
} from '@/features/expenses'
import { convertCents, crossRate, useFxRates } from '@/features/fx'
import { useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

const MAX_INLINE_CHIPS = 4

type AttributionMode = 'create' | 'edit'

type EditorProps = {
  tripId: string
  mode: AttributionMode
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
  const params = useLocalSearchParams<{
    id: string
    items?: string
    amountCents?: string
    currency?: string
    description?: string
    expenseId?: string
  }>()
  const tripId = paramString(params.id)
  const expenseId = paramString(params.expenseId)
  const isEdit = expenseId.length > 0

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
        <Screen title="Edit Smart Split" showBack>
          <View style={styles.center}>
            <ActivityIndicator />
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
      expenseId={null}
      items={parsedItems.map((item, position) => ({
        label: item.label,
        amountCents: item.amountCents,
        position,
      }))}
      totalCents={Number.parseInt(paramString(params.amountCents) || '0', 10)}
      expenseCurrency={paramString(params.currency) || 'EUR'}
      initialDescription={paramString(params.description) || 'Receipt'}
      initialAssignmentsByPosition={{}}
    />
  )
}

function AttributionEditor({
  tripId,
  mode,
  expenseId,
  items,
  totalCents,
  expenseCurrency,
  initialDescription,
  initialAssignmentsByPosition,
}: EditorProps) {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: trip } = useTrip(tripId)
  const { data: members } = useTripMembers(tripId)
  const { data: fx } = useFxRates()
  const createExpense = useCreateExpense(tripId)
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
  const [sheetOpenForPosition, setSheetOpenForPosition] = useState<number | null>(null)

  const itemsTotal = useMemo(() => items.reduce((sum, i) => sum + i.amountCents, 0), [items])

  const delta = itemsTotal - totalCents

  const assignments = useMemo(() => {
    const out: { position: number; memberId: string; share: number }[] = []
    for (const [posStr, set] of Object.entries(assignmentsByPosition)) {
      const position = Number.parseInt(posStr, 10)
      const memberIds = Array.from(set)
      if (memberIds.length === 0) continue
      const built = buildEqualAssignments([position], memberIds)
      out.push(...built)
    }
    return out
  }, [assignmentsByPosition])

  const memberTotals = useMemo(
    () => computeMemberTotalsCents(items, assignments),
    [items, assignments],
  )

  const unassignedCount = useMemo(() => {
    let count = 0
    for (let i = 0; i < items.length; i++) {
      const set = assignmentsByPosition[i]
      if (!set || set.size === 0) count++
    }
    return count
  }, [items.length, assignmentsByPosition])

  function toggleAssignment(position: number, memberId: string) {
    setAssignmentsByPosition((prev) => {
      const set = new Set(prev[position] ?? new Set<string>())
      if (set.has(memberId)) {
        set.delete(memberId)
      } else {
        set.add(memberId)
      }
      return { ...prev, [position]: set }
    })
  }

  if (!trip || !members) {
    return (
      <Screen title="Attribution" showBack>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    )
  }

  if (items.length === 0) {
    return (
      <Screen title="Attribution" showBack>
        <View style={styles.center}>
          <Text style={styles.muted}>No items detected from the receipt.</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.link}>Go back</Text>
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
    isForeign && fx ? convertCents(totalCents, expenseCurrency, tripCurrency, fx.rates) : totalCents

  const currentUserMember = members.find((m) => m.user_id === userId)

  async function onSave() {
    if (unassignedCount > 0) {
      Alert.alert(
        'Unassigned items',
        `${unassignedCount} item(s) have no member assigned. Assign or remove them first.`,
      )
      return
    }
    if (!currentUserMember) {
      Alert.alert('Membership error', 'Could not resolve your trip membership.')
      return
    }
    if (isForeign && !canConvert) {
      Alert.alert('Conversion failed', `Exchange rate for ${expenseCurrency} is unavailable.`)
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
          amountCents: totalCents,
          currency: expenseCurrency,
          baseAmountCents,
          fxRate,
          items,
          assignments,
        })
        router.back()
      } catch (error) {
        Alert.alert(
          'Could not save attribution',
          error instanceof Error ? error.message : 'Please try again.',
        )
      }
      return
    }

    // Create mode - two-step save: create the expense (bootstrap split) then
    // replace it with the item-driven split. If step 2 fails, soft-delete the
    // orphan expense so we don't leave a corrupt placeholder in the trip.
    let createdId: string | null = null
    try {
      const created = await createExpense.mutateAsync({
        tripId,
        description,
        amountCents: totalCents,
        currency: expenseCurrency,
        baseAmountCents,
        fxRate,
        splits: [{ memberId: currentUserMember.id, shareCents: baseAmountCents }],
      })
      createdId = created.id
      await upsertWithItems.mutateAsync({
        expenseId: created.id,
        description,
        amountCents: totalCents,
        currency: expenseCurrency,
        baseAmountCents,
        fxRate,
        items,
        assignments,
      })
      router.replace({ pathname: '/trips/[id]', params: { id: tripId } })
    } catch (error) {
      if (createdId) {
        // Compensate the orphan expense from step 1.
        await deleteExpense(createdId).catch(() => {})
      }
      Alert.alert(
        'Could not save attribution',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  const isPending = createExpense.isPending || upsertWithItems.isPending
  const totalLabel = mode === 'edit' ? 'Total' : 'OCR total'

  return (
    <Screen title={mode === 'edit' ? 'Edit Smart Split' : 'Smart Split'} showBack>
      <View style={styles.descriptionField}>
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Receipt"
        />
      </View>

      <Squircle
        color={theme.colors.card}
        borderWidth={0}
        radius={theme.radius.lg}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>{totalLabel}</Text>
          <Text style={styles.headerValue}>{formatAmount(totalCents, expenseCurrency)}</Text>
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>Items sum</Text>
          <Text style={[styles.headerValue, delta !== 0 ? { color: theme.colors.warning } : null]}>
            {formatAmount(itemsTotal, expenseCurrency)}
            {delta !== 0 ? `  (${delta > 0 ? '+' : ''}${(delta / 100).toFixed(2)})` : ''}
          </Text>
        </View>
      </Squircle>

      <FlashList
        data={items}
        keyExtractor={(item) => `${item.position}`}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const set = assignmentsByPosition[index] ?? new Set<string>()
          const inlineMembers = members.slice(0, MAX_INLINE_CHIPS)
          const remainder = members.length - inlineMembers.length
          const isUnassigned = set.size === 0
          return (
            <Squircle
              color={theme.colors.card}
              borderColor={isUnassigned ? theme.colors.warning : theme.colors.border}
              borderWidth={1}
              radius={theme.radius.md}
              style={styles.itemCard}
            >
              <View style={styles.itemRow}>
                <Text style={styles.itemLabel} numberOfLines={2}>
                  {item.label}
                </Text>
                <Text style={styles.itemAmount}>
                  {formatAmount(item.amountCents, expenseCurrency)}
                </Text>
              </View>
              <View style={styles.chipsRow}>
                {inlineMembers.map((member) => {
                  const selected = set.has(member.id)
                  const name = member.user_id === userId ? 'You' : (member.display_name ?? 'M')
                  const initial = name.charAt(0).toUpperCase()
                  return (
                    <MemberChip
                      key={member.id}
                      initial={initial}
                      selected={selected}
                      onPress={() => toggleAssignment(index, member.id)}
                    />
                  )
                })}
                {remainder > 0 ? (
                  <Pressable
                    onPress={() => setSheetOpenForPosition(index)}
                    accessibilityRole="button"
                    style={styles.moreChip}
                  >
                    <Text style={styles.moreChipText}>+{remainder}</Text>
                  </Pressable>
                ) : null}
              </View>
              {set.size > 1 ? (
                <Text style={styles.itemShared}>
                  Shared between {set.size} ·{' '}
                  {formatAmount(item.amountCents / set.size, expenseCurrency)} each
                </Text>
              ) : null}
            </Squircle>
          )
        }}
        ListFooterComponent={
          <View style={styles.footerSpacer}>
            <Text style={styles.muted}>
              Tip: tap several members on a single item to split it equally.
            </Text>
          </View>
        }
      />

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Per person ({tripCurrency})</Text>
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
            const name = member.user_id === userId ? 'You' : (member.display_name ?? 'M')
            return (
              <Squircle
                key={member.id}
                color={theme.colors.card}
                borderColor={theme.colors.border}
                borderWidth={1}
                radius={theme.radius.md}
                style={styles.summaryPill}
              >
                <Text style={styles.summaryName}>{name}</Text>
                <Text style={styles.summaryValue}>{formatAmount(cents, tripCurrency)}</Text>
              </Squircle>
            )
          })}
        </ScrollView>
        {unassignedCount > 0 ? (
          <Text style={styles.warn}>
            {unassignedCount} item{unassignedCount > 1 ? 's' : ''} still unassigned.
          </Text>
        ) : null}
        <Button
          label={isPending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save Smart Split'}
          onPress={onSave}
          disabled={isPending || unassignedCount > 0 || (isForeign && !canConvert)}
        />
      </View>

      <BottomSheet
        open={sheetOpenForPosition !== null}
        onClose={() => setSheetOpenForPosition(null)}
        title="Assign to…"
      >
        <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList}>
          {members.map((member) => {
            if (sheetOpenForPosition === null) return null
            const set = assignmentsByPosition[sheetOpenForPosition] ?? new Set<string>()
            const selected = set.has(member.id)
            const name = member.user_id === userId ? 'You' : (member.display_name ?? 'M')
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
                <Text style={styles.sheetRowText}>{name}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
        <Button label="Done" onPress={() => setSheetOpenForPosition(null)} />
      </BottomSheet>
    </Screen>
  )
}

function MemberChip({
  initial,
  selected,
  onPress,
}: {
  initial: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.chipActive : null]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>{initial}</Text>
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
  },
  link: {
    color: theme.colors.primary,
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
    fontWeight: '600',
  },
  headerValue: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  list: {
    paddingBottom: theme.gap(4),
  },
  itemCard: {
    gap: theme.gap(2),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(4),
    marginBottom: theme.gap(2),
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.gap(2),
  },
  itemLabel: {
    flex: 1,
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  itemAmount: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  itemShared: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  chip: {
    width: theme.gap(9),
    height: theme.gap(9),
    borderRadius: theme.gap(5),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  chipTextActive: {
    color: theme.colors.primaryForeground,
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
  moreChipText: {
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  footerSpacer: {
    paddingVertical: theme.gap(4),
  },
  summary: {
    gap: theme.gap(2),
    paddingTop: theme.gap(3),
    paddingHorizontal: theme.gap(2),
  },
  summaryTitle: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
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
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.foreground,
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
  },
}))
