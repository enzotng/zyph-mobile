import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { CategoryPicker } from '@/components/category-picker'
import { CurrencyPicker } from '@/components/currency-picker'
import { ReceiptScanner } from '@/components/receipt-scanner'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Spinner, Surface } from '@/components/ui'
import { useAuth } from '@/features/auth'
import {
  type CreateExpenseValues,
  createExpenseSchema,
  type ExpenseCategory,
  type ParsedReceiptItems,
  toCents,
  useCreateExpense,
  usePayersEditor,
  useSplitEditor,
} from '@/features/expenses'
import { PayersEditor } from '@/features/expenses/components/payers-editor'
import { RemainderBanner } from '@/features/expenses/components/remainder-banner'
import { SplitMemberRow } from '@/features/expenses/components/split-member-row'
import { SplitModeSelector } from '@/features/expenses/components/split-mode-selector'
import { convertCents, crossRate, useFxRates } from '@/features/fx'
import { useTripMembers } from '@/features/group'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

const AMOUNT_RE = /^\d+([.,]\d{1,2})?$/
const MAX_DESCRIPTION_LEN = 120

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

  // Payer defaults to the current user's membership; the editor allows one or several payers.
  const ownMemberId = members?.find((m) => m.user_id === userId)?.id ?? null

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
  const descriptionValue = useWatch({ control, name: 'description' })

  // Itemised (per-item) split without a receipt scan: hand the editor a manual flag plus the
  // currency and any description already typed, and it opens with one blank line to fill.
  function openManualSplit() {
    router.push({
      pathname: '/trips/[id]/attribute-expense',
      params: {
        id: tripId,
        manual: '1',
        currency,
        description: (descriptionValue ?? '').slice(0, MAX_DESCRIPTION_LEN),
      },
    })
  }

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

  const split = useSplitEditor({ members, baseCents })
  const payersEditor = usePayersEditor({ members, baseCents, defaultPayerId: ownMemberId })

  const blocked = (isForeign && !canConvert) || !split.canSubmit || !payersEditor.canSubmit

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

    const splits = split.splitsFor(baseAmountCents)
    if (splits.length === 0) {
      Alert.alert(t('expenseForm.selectSomeoneTitle'), t('expenseForm.selectSomeoneBody'))
      return
    }

    const { paidBy, payers } = payersEditor.resolve()

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
        paidBy,
        payers,
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
    <Screen
      title={t('expenseForm.addTitle')}
      scroll
      footer={
        <Button
          label={createExpense.isPending ? t('expenseForm.submitting') : t('expenseForm.submit')}
          onPress={handleSubmit(onSubmit)}
          disabled={createExpense.isPending || blocked}
        />
      }
    >
      <View style={styles.quickActions}>
        <Pressable
          onPress={() => setScannerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('expenseForm.scanReceipt')}
          style={styles.quickAction}
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
        <Pressable
          onPress={openManualSplit}
          accessibilityRole="button"
          accessibilityLabel={t('expenseForm.splitByItem')}
          style={styles.quickAction}
        >
          <Surface
            color="transparent"
            borderColor={theme.colors.border}
            borderWidth={1}
            radius={theme.radius.md}
            style={styles.scanBtnSurface}
          >
            <Ionicons name="list-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.scanLabel}>{t('expenseForm.splitByItem')}</Text>
          </Surface>
        </Pressable>
      </View>

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

      <CurrencyPicker
        label={t('expenseForm.currency')}
        value={currency}
        currencies={currencies}
        onChange={setPicked}
      />

      <CategoryPicker label={t('expenseForm.category')} value={category} onChange={setCategory} />

      <PayersEditor
        label={t('expenseForm.paidBy')}
        editor={payersEditor}
        members={members}
        currentUserId={userId}
        tripCurrency={tripCurrency}
        baseCents={baseCents}
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
  warn: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.bold,
    color: theme.colors.muted,
  },
  quickActions: {
    flexDirection: 'row',
    gap: theme.gap(2),
  },
  quickAction: {
    flex: 1,
  },
  scanBtnSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
  },
  scanLabel: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.sans.semibold,
  },
}))
