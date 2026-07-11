import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { TRIP_TAB_BAR_CLEARANCE } from '@/components/layout/trip-tab-bar'
import { TextField } from '@/components/text-field'
import { Amount, EmptyState, ErrorState, SectionTitle, Skeleton } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  expensesByCategory,
  formatAmount,
  toCents,
  totalSpentCents,
  useExpenses,
} from '@/features/expenses'
import { categoryColor, iconForCode, labelKeyForCode } from '@/features/taxonomy'
import {
  type BudgetLevel,
  type Dietary,
  type Interest,
  MONEY,
  type Pace,
  type Trip,
  type TripType,
  useTrip,
  useUpdateTripPreferences,
} from '@/features/trips'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'

// Self-contained Stats body: owns its own ScrollView (no parent Screen `scroll`) so it can be
// dropped into both the Spend tab's in-place segment and the `/analytics` route wrapper.
export function StatsView({ tripId }: { tripId: string }) {
  const { t } = useTranslation()

  const expensesQuery = useExpenses(tripId)
  const tripQuery = useTrip(tripId)

  const currency = tripQuery.data?.currency ?? 'EUR'
  const expenses = expensesQuery.data ?? []
  const loading = expensesQuery.isLoading || tripQuery.isLoading
  const errored = expensesQuery.isError || tripQuery.isError

  const categories = expensesByCategory(expenses)
  const maxCents = categories[0]?.cents ?? 0
  const total = totalSpentCents(expenses)

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // iOS: inset for the keyboard and scroll the focused field into view (no-op on Android,
      // which resizes the window instead).
      automaticallyAdjustKeyboardInsets
    >
      {loading ? (
        <View style={styles.section}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={200} radius={20} />
        </View>
      ) : errored ? (
        <ErrorState
          title={t('analytics.errorTitle')}
          body={t('analytics.errorBody')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            void expensesQuery.refetch()
            void tripQuery.refetch()
          }}
        />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon="stats-chart-outline"
          title={t('analytics.emptyTitle')}
          body={t('analytics.emptyBody')}
        />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.total}>{formatAmount(total, currency)}</Text>
            <Text style={styles.totalSub}>
              {t('analytics.subtitle', { count: expenses.length })}
            </Text>
          </View>
          {tripQuery.data ? <BudgetCard trip={tripQuery.data} spentCents={total} /> : null}
          <View style={styles.section}>
            <SectionTitle>{t('analytics.byCategory')}</SectionTitle>
            {categories.map((row) => {
              const color = categoryColor(row.category)
              const fillPercent = maxCents > 0 ? (row.cents / maxCents) * 100 : 0
              const share = total > 0 ? Math.round((row.cents / total) * 100) : 0
              const label = row.category
                ? t(labelKeyForCode(row.category))
                : t('analytics.uncategorized')
              return (
                <View key={row.category ?? 'uncategorized'} style={styles.barRow}>
                  <View style={[styles.iconChip, { backgroundColor: withAlpha(color, 0.18) }]}>
                    <Ionicons name={iconForCode(row.category)} size={15} color={color} />
                  </View>
                  <View style={styles.barBody}>
                    <View style={styles.barHead}>
                      <Text style={styles.barLabel} numberOfLines={1}>
                        {label}
                      </Text>
                      <Text style={styles.barShare}>{share}%</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${fillPercent}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                  </View>
                  <Amount cents={row.cents} currency={currency} size={13} neutral />
                </View>
              )
            })}
          </View>
        </>
      )}
    </ScrollView>
  )
}

// Owns its own input state so the screen stays declarative: a gauge when the trip has a budget,
// or an inline "set a budget" field when it doesn't. Preferences are a full-object update, so
// saving the budget echoes the trip's current profile fields to avoid wiping them out.
// Editing the budget is owner-only (trips_update_owner RLS - gated again here in the UI):
// members get the read-only gauge when a budget is set, and nothing otherwise. The `editing`
// state is checked first so the same validated field + save() serves both setting a first
// budget and editing an already-set one; `editing` can only flip to true from owner-gated
// affordances (the CTA below and the gauge's edit button), so a non-owner never reaches it.
function BudgetCard({ trip, spentCents }: { trip: Trip; spentCents: number }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { session } = useAuth()
  const update = useUpdateTripPreferences()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | undefined>()

  const isOwner = session?.user.id === trip.owner_id
  const budget = trip.budget_total_cents
  const hasBudget = budget != null && budget > 0

  async function save() {
    const trimmed = value.trim()
    // Guard against a malformed amount (a lone '.'/',' or pasted non-numeric text) reaching
    // toCents(), which would return NaN and silently clear the budget once supabase-js
    // serializes it to null. An empty value is the intentional "clear the budget" path.
    if (trimmed !== '' && !MONEY.test(trimmed)) {
      setError(t('analytics.invalidBudget'))
      return
    }
    setError(undefined)
    const budgetTotalCents = trimmed === '' ? null : toCents(trimmed)
    try {
      await update.mutateAsync({
        id: trip.id,
        tripType: (trip.trip_type ?? null) as TripType | null,
        budgetLevel: (trip.budget_level ?? null) as BudgetLevel | null,
        budgetTotalCents,
        pace: (trip.pace ?? null) as Pace | null,
        interests: (trip.interests ?? []) as Interest[],
        dietary: (trip.dietary ?? []) as Dietary[],
      })
      haptics.success()
      setEditing(false)
    } catch (error) {
      haptics.error()
      Alert.alert(
        t('tripPreferences.saveError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  // Seeds the field with the current budget as a decimal string (same read-back preferences.tsx
  // uses) so editing starts from the existing value instead of a blank one; a first-time set
  // (no budget yet) starts blank.
  function startEditing() {
    setValue(budget != null ? (budget / 100).toFixed(2) : '')
    setError(undefined)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setError(undefined)
  }

  if (editing) {
    return (
      <View style={styles.budgetCard}>
        <View style={styles.budgetEdit}>
          <TextField
            value={value}
            onChangeText={(text) => {
              setValue(text)
              setError(undefined)
            }}
            keyboardType="decimal-pad"
            placeholder={t('analytics.budgetPlaceholder')}
            error={error}
            autoFocus
          />
          <View style={styles.budgetEditActions}>
            <Button
              label={t('analytics.saveBudget')}
              size="sm"
              block={false}
              loading={update.isPending}
              onPress={() => void save()}
            />
            <Button
              label={t('common.cancel')}
              variant="ghost"
              size="sm"
              block={false}
              onPress={cancelEditing}
            />
          </View>
        </View>
      </View>
    )
  }

  if (hasBudget) {
    const remaining = budget - spentCents
    const over = remaining < 0
    const percent = Math.min(100, Math.round((spentCents / budget) * 100))
    return (
      <View style={styles.budgetCard}>
        <View style={styles.barHead}>
          <Text style={styles.budgetLabel}>{t('analytics.budget')}</Text>
          <View style={styles.budgetHeadRight}>
            <Text style={styles.budgetTotals}>
              {formatAmount(spentCents, trip.currency)} / {formatAmount(budget, trip.currency)}
            </Text>
            {isOwner ? (
              <Pressable
                onPress={startEditing}
                accessibilityRole="button"
                accessibilityLabel={t('common.edit')}
                hitSlop={8}
              >
                <Ionicons name="create-outline" size={16} color={theme.colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>
        <View style={styles.gaugeTrack}>
          <View
            style={[
              styles.gaugeFill,
              {
                width: `${percent}%`,
                backgroundColor: over ? theme.colors.destructive : theme.colors.primary,
              },
            ]}
          />
        </View>
        <Text style={[styles.budgetSub, over && styles.budgetOver]}>
          {over
            ? t('analytics.budgetOver', { amount: formatAmount(-remaining, trip.currency) })
            : t('analytics.budgetRemaining', { amount: formatAmount(remaining, trip.currency) })}
        </Text>
      </View>
    )
  }

  if (!isOwner) {
    return null
  }

  return (
    <View style={styles.budgetCard}>
      <Button
        label={t('analytics.setBudget')}
        variant="secondary"
        size="sm"
        icon="wallet-outline"
        block={false}
        onPress={startEditing}
      />
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  flex: { flex: 1 },
  // Sits inside the parent Screen's `content`, which already insets `paddingHorizontal: gap(6)`
  // and `paddingTop: gap(2)` - so this only adds the extra top gap(2) to match the original
  // `Screen scroll` body's gap(4) total, plus the bottom safe-area padding and inter-section gap.
  scrollContent: {
    paddingTop: theme.gap(2),
    // Reserve the floating trip tab bar's clearance: this view also renders in-place inside the
    // Spend tab, where the bar floats over the content (the standalone route covers it instead,
    // so the extra whitespace there is harmless).
    paddingBottom: rt.insets.bottom + TRIP_TAB_BAR_CLEARANCE,
    gap: theme.gap(4),
  },
  section: { gap: theme.gap(4) },
  hero: {
    alignItems: 'center',
    gap: theme.gap(1),
    paddingVertical: theme.gap(6),
  },
  total: {
    fontFamily: theme.fonts.display.bold,
    fontSize: theme.fontSize.xxl,
    color: theme.colors.foreground,
  },
  totalSub: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: theme.gap(2.5) },
  iconChip: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barBody: { flex: 1, gap: theme.gap(1) },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barLabel: {
    flex: 1,
    fontFamily: theme.fonts.sans.medium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  barShare: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  barTrack: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.border, 0.6),
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: theme.radius.full },
  budgetCard: {
    gap: theme.gap(3),
    padding: theme.gap(4),
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  budgetLabel: {
    fontFamily: theme.fonts.sans.medium,
    fontSize: theme.fontSize.sm,
    color: theme.colors.foreground,
  },
  budgetTotals: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  budgetHeadRight: { flexDirection: 'row', alignItems: 'center', gap: theme.gap(1.5) },
  gaugeTrack: {
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  },
  gaugeFill: { height: 8, borderRadius: theme.radius.full },
  budgetSub: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  budgetOver: { color: theme.colors.destructive },
  budgetEdit: { gap: theme.gap(2.5) },
  budgetEditActions: { flexDirection: 'row', alignItems: 'center', gap: theme.gap(2.5) },
}))
