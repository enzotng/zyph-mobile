import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { CategoryPicker } from '@/components/category-picker'
import { CurrencySelect } from '@/components/currency-select'
import { ReceiptScanner } from '@/components/receipt-scanner'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Spinner, Surface } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  type CreateExpenseValues,
  computeSplits,
  createExpenseSchema,
  type ExpenseCategory,
  formatAmount,
  type ParsedReceiptItems,
  toCents,
  useCreateExpense,
} from '@/features/expenses'
import { convertCents, crossRate, useFxRates } from '@/features/fx'
import { useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

const AMOUNT_RE = /^\d+([.,]\d{1,2})?$/
const MAX_DESCRIPTION_LEN = 120

type ShareState = Record<string, { included: boolean; weight: number }>

export default function AddExpenseScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const { session } = useAuth()
  const userId = session?.user.id
  const { data: trip } = useTrip(tripId)
  const { data: members } = useTripMembers(tripId)
  const { data: fx } = useFxRates()
  const createExpense = useCreateExpense(tripId)

  const tripCurrency = trip?.currency ?? 'EUR'
  const [picked, setPicked] = useState<string | null>(null)
  const currency = picked ?? tripCurrency

  // Only user-touched members are stored; everyone else defaults to included, weight 1.
  // Deriving the default (instead of seeding state) avoids a setState-in-effect and
  // means members who join while the form is open are included by default.
  const [overrides, setOverrides] = useState<ShareState>({})
  const stateFor = useCallback(
    (memberId: string) => overrides[memberId] ?? { included: true, weight: 1 },
    [overrides],
  )

  const [scannerOpen, setScannerOpen] = useState(false)
  const [category, setCategory] = useState<ExpenseCategory | null>(null)

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateExpenseValues>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: { description: '', amount: '' },
  })

  function applyScan(parsed: ParsedReceiptItems) {
    setScannerOpen(false)
    if (parsed.merchant) {
      setValue('description', parsed.merchant.slice(0, MAX_DESCRIPTION_LEN), {
        shouldValidate: true,
      })
    }
    if (parsed.amountCents !== null) {
      setValue('amount', (parsed.amountCents / 100).toFixed(2), { shouldValidate: true })
    }
    let resolvedCurrency = currency
    if (parsed.currency && parsed.currency !== currency) {
      // `rates[code]` can legitimately be 0 (degenerate) - check for explicit presence.
      const known = !fx || fx.rates[parsed.currency] !== undefined
      if (known) {
        setPicked(parsed.currency)
        resolvedCurrency = parsed.currency
      }
    }
    // Smart Split: if line items were detected, jump to the attribution screen.
    if (parsed.items.length >= 2 && parsed.amountCents !== null) {
      router.push({
        pathname: '/trips/[id]/attribute-expense',
        params: {
          id: tripId,
          items: JSON.stringify(parsed.items),
          amountCents: String(parsed.amountCents),
          currency: resolvedCurrency,
          description:
            parsed.merchant?.slice(0, MAX_DESCRIPTION_LEN) ?? t('smartSplit.defaultDescription'),
        },
      })
    }
  }

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

  // Trip-currency amount for the entered value, or null when it can't be resolved yet.
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

  // Live per-member shares for the preview (memberId -> cents).
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

    const splits = computeSplits(baseAmountCents, participants)
    if (splits.length === 0) {
      Alert.alert(t('expenseForm.selectSomeoneTitle'), t('expenseForm.selectSomeoneBody'))
      return
    }

    try {
      await createExpense.mutateAsync({
        tripId,
        description: values.description,
        amountCents,
        currency,
        baseAmountCents,
        fxRate,
        splits,
        category,
      })
      router.back()
    } catch (error) {
      Alert.alert(
        t('expenseForm.createError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  // Wait for the trip + members so the currency starts on the trip's currency and the
  // split list is fully populated before the user interacts.
  if (!trip || !members) {
    return (
      <Screen title={t('expenseForm.addTitle')}>
        <Spinner label={t('common.loading')} />
      </Screen>
    )
  }

  return (
    <Screen title={t('expenseForm.addTitle')} scroll>
      <Pressable
        onPress={() => setScannerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('expenseForm.scanReceipt')}
        style={styles.scanBtn}
      >
        <Surface
          color="transparent"
          borderColor={theme.colors.border}
          borderWidth={1}
          radius={theme.radius.md}
          style={styles.scanBtnSurface}
        >
          <Ionicons name="scan-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.scanLabel}>{t('expenseForm.scanReceipt')}</Text>
        </Surface>
      </Pressable>

      <ReceiptScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={applyScan}
      />

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

      <CategoryPicker label={t('expenseForm.category')} value={category} onChange={setCategory} />

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

      <Button
        label={createExpense.isPending ? t('expenseForm.submitting') : t('expenseForm.submit')}
        onPress={handleSubmit(onSubmit)}
        disabled={createExpense.isPending || blocked}
      />
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  warn: {
    fontSize: theme.fontSize.sm,
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
    fontFamily: theme.fonts.sans.semibold,
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
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.foreground,
  },
  scanBtn: {
    alignSelf: 'flex-start',
  },
  scanBtnSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
  },
  scanLabel: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.sans.semibold,
  },
}))
