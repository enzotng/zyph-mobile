import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { CurrencyPicker } from '@/components/currency-picker'
import { Screen } from '@/components/screen'
import { TaxonomyCategoryPicker } from '@/components/taxonomy-category-picker'
import { TextField } from '@/components/text-field'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  type CreateExpenseValues,
  createExpenseSchema,
  toCents,
  useExpense,
  useExpensePayers,
  useExpenseSplits,
  usePayersEditor,
  useSplitEditor,
  useUpdateExpense,
} from '@/features/expenses'
import { PayersEditor } from '@/features/expenses/components/payers-editor'
import { RemainderBanner } from '@/features/expenses/components/remainder-banner'
import { SplitMemberRow } from '@/features/expenses/components/split-member-row'
import { SplitModeSelector } from '@/features/expenses/components/split-mode-selector'
import { convertCents, crossRate, useFxRates } from '@/features/fx'
import { useTripMembers } from '@/features/group'
import { isValidCategory } from '@/features/taxonomy'
import { useTrip } from '@/features/trips'
import { formatAmount } from '@/lib/money'
import { paramString } from '@/lib/routing'

const AMOUNT_RE = /^\d+([.,]\d{1,2})?$/

export default function EditExpenseScreen() {
  const params = useLocalSearchParams<{ id: string; expenseId: string }>()
  const tripId = paramString(params.id)
  const expenseId = paramString(params.expenseId)
  const router = useRouter()
  const { t } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user.id

  const { data: expense, isLoading: expLoading } = useExpense(expenseId)
  const { data: splits, isLoading: splitsLoading } = useExpenseSplits(expenseId)
  const { data: payers, isLoading: payersLoading } = useExpensePayers(expenseId)
  const { data: trip } = useTrip(tripId)
  const { data: members } = useTripMembers(tripId)
  const { data: fx } = useFxRates()
  const updateExpense = useUpdateExpense(tripId)

  const tripCurrency = trip?.currency ?? 'EUR'
  const [picked, setPicked] = useState<string | null>(null)
  const currency = picked ?? expense?.currency ?? tripCurrency

  // Same lazy pattern as currency: picked overrides the loaded value when the user changes it.
  const [pickedCategory, setPickedCategory] = useState<string | null | undefined>(undefined)
  const expenseCategory = isValidCategory(expense?.category) ? (expense?.category ?? null) : null
  const category = pickedCategory === undefined ? expenseCategory : pickedCategory

  const [pickedSubcategory, setPickedSubcategory] = useState<string | null | undefined>(undefined)
  const subcategory =
    pickedSubcategory === undefined ? (expense?.subcategory ?? null) : pickedSubcategory

  // Payer falls back to the loaded paid_by then the current user; the editor seeds from the stored
  // payer rows (more than one opens it in multiple mode).
  const ownMemberId = members?.find((m) => m.user_id === userId)?.id ?? null
  const initialPayers = useMemo(
    () => payers?.map((p) => ({ memberId: p.member_id, paidCents: p.paid_cents })),
    [payers],
  )

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateExpenseValues>({
    resolver: zodResolver(createExpenseSchema),
    // RHF syncs form values from this object whenever it changes; keepDirtyValues so a refetch
    // mid-edit does not wipe unsaved changes. No useEffect needed.
    resetOptions: { keepDirtyValues: true },
    values: expense
      ? { description: expense.description, amount: (expense.amount_cents / 100).toFixed(2) }
      : undefined,
    defaultValues: { description: '', amount: '' },
  })

  const amount = useWatch({ control, name: 'amount' })

  const currencies = useMemo(() => {
    const rest = fx
      ? Object.keys(fx.rates)
          .filter((c) => c !== tripCurrency)
          .sort()
      : []
    return [tripCurrency, ...rest]
  }, [fx, tripCurrency])

  const isForeign = currency !== tripCurrency
  const canConvert = !isForeign || Boolean(fx?.rates[currency] && fx?.rates[tripCurrency])

  const baseCents = useMemo(() => {
    if (!AMOUNT_RE.test((amount ?? '').trim())) {
      return null
    }
    const cents = toCents(amount)
    if (!isForeign) {
      return cents
    }
    if (!canConvert || !fx) {
      return null
    }
    return convertCents(cents, currency, tripCurrency, fx.rates)
  }, [amount, canConvert, currency, fx, isForeign, tripCurrency])

  const split = useSplitEditor({ members, baseCents, initialSplits: splits, initialMode: 'shares' })
  const payersEditor = usePayersEditor({
    members,
    baseCents,
    defaultPayerId: expense?.paid_by ?? ownMemberId,
    initialPayers,
  })

  const blocked = (isForeign && !canConvert) || !split.canSubmit || !payersEditor.canSubmit

  // Concise reason shown next to a disabled save, so the blocking banner is never off-screen.
  const blockReason = !blocked
    ? null
    : isForeign && !canConvert
      ? t('expenseForm.rateUnavailable', { currency })
      : split.includedCount === 0
        ? t('expenseForm.selectSomeoneTitle')
        : !split.isBalanced && baseCents !== null
          ? t('expenseForm.remainderLeft', {
              amount: formatAmount(Math.abs(split.remainderCents), tripCurrency),
            })
          : payersEditor.mode === 'multiple' && !payersEditor.isBalanced && baseCents !== null
            ? t('expenseForm.remainderLeft', {
                amount: formatAmount(Math.abs(payersEditor.remainderCents), tripCurrency),
              })
            : t('expenseForm.incomplete')

  async function onSubmit(values: CreateExpenseValues) {
    const amountCents = toCents(values.amount)
    let baseAmountCents = amountCents
    let fxRate = 1

    if (isForeign) {
      if (!fx) {
        Alert.alert(t('expenseForm.ratesUnavailableTitle'), t('expenseForm.ratesUnavailableBody'))
        return
      }
      try {
        baseAmountCents = convertCents(amountCents, currency, tripCurrency, fx.rates)
        fxRate = crossRate(currency, tripCurrency, fx.rates)
      } catch (error) {
        Alert.alert(
          t('expenseForm.conversionFailed'),
          error instanceof Error ? error.message : t('common.tryAgain'),
        )
        return
      }
    }

    const splitInputs = split.splitsFor(baseAmountCents)
    if (splitInputs.length === 0) {
      Alert.alert(t('expenseForm.selectSomeoneTitle'), t('expenseForm.selectSomeoneBody'))
      return
    }

    const { paidBy, payers: resolvedPayers } = payersEditor.resolve()

    try {
      await updateExpense.mutateAsync({
        expenseId,
        description: values.description,
        amountCents,
        currency,
        baseAmountCents,
        fxRate,
        splits: splitInputs,
        category,
        subcategory,
        paidBy,
        payers: resolvedPayers,
      })
      router.back()
    } catch (error) {
      Alert.alert(
        t('expenseForm.updateError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  if (expLoading || splitsLoading || payersLoading || !expense || !trip || !members) {
    return (
      <Screen title={t('expenseForm.editTitle')} showBack>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  return (
    <Screen
      title={t('expenseForm.editTitle')}
      scroll
      footer={
        <View style={styles.footerBar}>
          {blockReason ? <Text style={styles.footerReason}>{blockReason}</Text> : null}
          <Button
            label={updateExpense.isPending ? t('common.saving') : t('common.save')}
            onPress={handleSubmit(onSubmit)}
            disabled={updateExpense.isPending || blocked}
          />
        </View>
      }
    >
      <View style={styles.form}>
        <View style={styles.group}>
          <Text style={styles.fieldLabel}>{t('expenseForm.description')}</Text>
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <TextField
                placeholder={t('expenseForm.descriptionPlaceholder')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.description?.message}
              />
            )}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.fieldLabel}>{t('expenseForm.sectionAmount')}</Text>
          <View style={styles.amountRow}>
            <CurrencyPicker compact value={currency} currencies={currencies} onChange={setPicked} />
            <View style={styles.flex}>
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <TextField
                    placeholder="45.00"
                    keyboardType="decimal-pad"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.amount?.message}
                  />
                )}
              />
            </View>
          </View>
          {isForeign && !canConvert ? (
            <Text style={styles.warn}>{t('expenseForm.rateUnavailable', { currency })}</Text>
          ) : null}
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.fieldLabel}>{t('expenseForm.paidBy')}</Text>
            <PayersEditor
              editor={payersEditor}
              members={members}
              currentUserId={userId}
              tripCurrency={tripCurrency}
              baseCents={baseCents}
            />
          </View>
          <View style={styles.col}>
            <TaxonomyCategoryPicker
              label={t('expenseForm.category')}
              flag="expenses"
              allowNone
              category={category}
              subcategory={subcategory}
              onChange={({ category, subcategory }) => {
                setPickedCategory(category)
                setPickedSubcategory(subcategory)
              }}
            />
          </View>
        </View>

        <View style={styles.group}>
          <View style={styles.splitHeader}>
            <Text style={[styles.fieldLabel, styles.splitHeaderLabel]} numberOfLines={1}>
              {`${t('expenseForm.splitBetween')} - ${split.includedCount}/${members.length}`}
            </Text>
            <View style={styles.splitHeaderRight}>
              <Pressable
                onPress={split.includedCount === members.length ? split.clearAll : split.selectAll}
                accessibilityRole="button"
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <Text style={styles.smallAction}>
                  {split.includedCount === members.length
                    ? t('expenseForm.selectNone')
                    : t('expenseForm.selectAll')}
                </Text>
              </Pressable>
              <SplitModeSelector mode={split.mode} onChange={split.setMode} />
            </View>
          </View>
          {members.map((member) => (
            <SplitMemberRow
              key={member.id}
              member={member}
              split={split}
              tripCurrency={tripCurrency}
              currentUserId={userId}
            />
          ))}
          <RemainderBanner
            mode={split.mode}
            allocatedCents={split.allocatedCents}
            remainderCents={split.remainderCents}
            isBalanced={split.isBalanced}
            baseCents={baseCents}
            tripCurrency={tripCurrency}
          />
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warn: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.warning,
  },
  form: {
    gap: theme.gap(4),
  },
  group: {
    gap: theme.gap(1.5),
  },
  twoCol: {
    flexDirection: 'row',
    gap: theme.gap(3),
  },
  col: {
    flex: 1,
    gap: theme.gap(1.5),
  },
  fieldLabel: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  flex: {
    flex: 1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.gap(2),
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2),
  },
  splitHeaderLabel: {
    flexShrink: 1,
  },
  splitHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  smallAction: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  footerBar: {
    gap: theme.gap(2),
  },
  footerReason: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    color: theme.colors.muted,
    textAlign: 'center',
  },
}))
