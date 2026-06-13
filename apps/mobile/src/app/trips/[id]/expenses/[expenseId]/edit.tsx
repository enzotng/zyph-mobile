import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { CategoryPicker } from '@/components/category-picker'
import { CurrencySelect } from '@/components/currency-select'
import { PaidBySelect } from '@/components/paid-by-select'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  type CreateExpenseValues,
  createExpenseSchema,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  toCents,
  useExpense,
  useExpenseSplits,
  useSplitEditor,
  useUpdateExpense,
} from '@/features/expenses'
import { RemainderBanner } from '@/features/expenses/components/remainder-banner'
import { SplitMemberRow } from '@/features/expenses/components/split-member-row'
import { SplitModeSelector } from '@/features/expenses/components/split-mode-selector'
import { convertCents, crossRate, useFxRates } from '@/features/fx'
import { useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'
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
  const { data: trip } = useTrip(tripId)
  const { data: members } = useTripMembers(tripId)
  const { data: fx } = useFxRates()
  const updateExpense = useUpdateExpense(tripId)

  const tripCurrency = trip?.currency ?? 'EUR'
  const [picked, setPicked] = useState<string | null>(null)
  const currency = picked ?? expense?.currency ?? tripCurrency

  // Same lazy pattern as currency: picked overrides the loaded value when the user changes it.
  const [pickedCategory, setPickedCategory] = useState<ExpenseCategory | null | undefined>(
    undefined,
  )
  const expenseCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(
    expense?.category ?? '',
  )
    ? (expense?.category as ExpenseCategory)
    : null
  const category = pickedCategory === undefined ? expenseCategory : pickedCategory

  // Payer: lazy override of the loaded paid_by, falling back to the current user's membership.
  const [pickedPayer, setPickedPayer] = useState<string | null>(null)
  const ownMemberId = members?.find((m) => m.user_id === userId)?.id ?? null
  const paidBy = pickedPayer ?? expense?.paid_by ?? ownMemberId

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateExpenseValues>({
    resolver: zodResolver(createExpenseSchema),
    // RHF syncs form values from this object whenever it changes; no useEffect needed.
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

  const blocked = (isForeign && !canConvert) || !split.canSubmit

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
        paidBy,
      })
      router.back()
    } catch (error) {
      Alert.alert(
        t('expenseForm.updateError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  if (expLoading || splitsLoading || !expense || !trip || !members) {
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
        <Button
          label={updateExpense.isPending ? t('common.saving') : t('common.save')}
          onPress={handleSubmit(onSubmit)}
          disabled={updateExpense.isPending || blocked}
        />
      }
    >
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextField
            label={t('expenseForm.description')}
            placeholder={t('expenseForm.descriptionPlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.description?.message}
          />
        )}
      />

      <CurrencySelect
        label={t('expenseForm.currency')}
        value={currency}
        currencies={currencies}
        onChange={setPicked}
      />

      <CategoryPicker
        label={t('expenseForm.category')}
        value={category}
        onChange={setPickedCategory}
      />

      <PaidBySelect
        label={t('expenseForm.paidBy')}
        value={paidBy}
        members={members}
        currentUserId={userId}
        onChange={setPickedPayer}
      />

      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <TextField
            label={t('expenseForm.amount', { currency })}
            placeholder="45.00"
            keyboardType="decimal-pad"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.amount?.message}
          />
        )}
      />

      {isForeign && !canConvert ? (
        <Text style={styles.warn}>{t('expenseForm.rateUnavailable', { currency })}</Text>
      ) : null}

      <Text style={styles.sectionTitle}>{t('expenseForm.splitBetween')}</Text>
      <SplitModeSelector mode={split.mode} onChange={split.setMode} />
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
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.bold,
    color: theme.colors.muted,
  },
}))
