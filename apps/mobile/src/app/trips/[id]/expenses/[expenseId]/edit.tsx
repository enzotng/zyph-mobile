import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { CategoryPicker } from '@/components/category-picker'
import { CurrencySelect } from '@/components/currency-select'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Spinner, Surface } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  type CreateExpenseValues,
  computeSplits,
  createExpenseSchema,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  formatAmount,
  toCents,
  useExpense,
  useExpenseSplits,
  useUpdateExpense,
} from '@/features/expenses'
import { convertCents, crossRate, useFxRates } from '@/features/fx'
import { useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

const AMOUNT_RE = /^\d+([.,]\d{1,2})?$/

type ShareState = Record<string, { included: boolean; weight: number }>

export default function EditExpenseScreen() {
  const params = useLocalSearchParams<{ id: string; expenseId: string }>()
  const tripId = paramString(params.id)
  const expenseId = paramString(params.expenseId)
  const router = useRouter()
  const { t } = useTranslation()
  const { theme } = useUnistyles()
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

  // Only stores user changes; the effective state is derived by merging with the
  // loaded splits, so no async-to-state effect is needed.
  const [overrides, setOverrides] = useState<ShareState>({})

  const originallyIncluded = useMemo(
    () => new Set((splits ?? []).map((s) => s.member_id)),
    [splits],
  )

  const stateFor = useCallback(
    (memberId: string) => {
      const override = overrides[memberId]
      if (override) {
        return override
      }
      return { included: originallyIncluded.has(memberId), weight: 1 }
    },
    [overrides, originallyIncluded],
  )

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

  const participants = useMemo(() => {
    if (!members) {
      return []
    }
    return members
      .filter((m) => stateFor(m.id).included)
      .map((m) => ({ memberId: m.id, weight: stateFor(m.id).weight }))
  }, [members, stateFor])

  const shareByMember = useMemo(() => {
    if (baseCents === null) {
      return new Map<string, number>()
    }
    return new Map(computeSplits(baseCents, participants).map((s) => [s.memberId, s.shareCents]))
  }, [baseCents, participants])

  const blocked = (isForeign && !canConvert) || participants.length === 0

  function toggle(memberId: string) {
    setOverrides((s) => {
      const cur = s[memberId] ?? { included: true, weight: 1 }
      return { ...s, [memberId]: { ...cur, included: !cur.included } }
    })
  }

  function setWeight(memberId: string, weight: number) {
    setOverrides((s) => {
      const cur = s[memberId] ?? { included: true, weight: 1 }
      return { ...s, [memberId]: { ...cur, weight: Math.max(1, weight) } }
    })
  }

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

    const splitInputs = computeSplits(baseAmountCents, participants)
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
      {members.map((member) => {
        const state = stateFor(member.id)
        const included = state.included
        const name =
          member.user_id === userId ? t('common.you') : (member.display_name ?? t('common.member'))
        const share = shareByMember.get(member.id)
        return (
          <View key={member.id} style={styles.memberRow}>
            <Pressable
              style={styles.memberLeft}
              onPress={() => toggle(member.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: included }}
            >
              <Ionicons
                name={included ? 'checkbox' : 'square-outline'}
                size={22}
                color={included ? theme.colors.primary : theme.colors.muted}
              />
              <Text style={styles.memberName}>{name}</Text>
            </Pressable>

            {included ? (
              <View style={styles.memberRight}>
                <Surface
                  color="transparent"
                  borderColor={theme.colors.border}
                  borderWidth={1}
                  radius={theme.radius.md}
                  style={styles.stepper}
                >
                  <Pressable
                    onPress={() => setWeight(member.id, state.weight - 1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('expenseForm.decreaseShares')}
                    hitSlop={6}
                  >
                    <Ionicons name="remove" size={18} color={theme.colors.foreground} />
                  </Pressable>
                  <Text style={styles.weight}>{state.weight}</Text>
                  <Pressable
                    onPress={() => setWeight(member.id, state.weight + 1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('expenseForm.increaseShares')}
                    hitSlop={6}
                  >
                    <Ionicons name="add" size={18} color={theme.colors.foreground} />
                  </Pressable>
                </Surface>
                <Text style={styles.share}>
                  {share === undefined ? '-' : formatAmount(share, tripCurrency)}
                </Text>
              </View>
            ) : null}
          </View>
        )
      })}
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.gap(2),
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    flex: 1,
  },
  memberName: {
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.foreground,
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingHorizontal: theme.gap(2),
    paddingVertical: theme.gap(1),
  },
  weight: {
    minWidth: theme.gap(4),
    textAlign: 'center',
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.foreground,
  },
  share: {
    minWidth: theme.gap(16),
    textAlign: 'right',
    fontFamily: theme.fonts.display.bold,
    color: theme.colors.foreground,
  },
}))
