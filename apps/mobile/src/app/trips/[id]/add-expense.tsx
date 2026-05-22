import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { ActivityIndicator, Alert, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { CurrencySelect } from '@/components/currency-select'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import {
  type CreateExpenseValues,
  createExpenseSchema,
  formatAmount,
  toCents,
  useCreateExpense,
} from '@/features/expenses'
import { convertCents, crossRate, useFxRates } from '@/features/fx'
import { useTrip } from '@/features/trips'

const AMOUNT_RE = /^\d+([.,]\d{1,2})?$/

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? ''
  const router = useRouter()
  const { data: trip } = useTrip(tripId)
  const { data: fx } = useFxRates()
  const createExpense = useCreateExpense(tripId)

  const tripCurrency = trip?.currency ?? 'EUR'
  const [picked, setPicked] = useState<string | null>(null)
  const currency = picked ?? tripCurrency

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateExpenseValues>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: { description: '', amount: '' },
  })

  const amount = useWatch({ control, name: 'amount' })

  // Trip currency first, then every ECB currency alphabetically.
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

  // Live preview of the trip-currency equivalent for a foreign amount.
  const preview = useMemo(() => {
    if (!isForeign || !canConvert || !fx || !AMOUNT_RE.test((amount ?? '').trim())) {
      return null
    }
    const base = convertCents(toCents(amount), currency, tripCurrency, fx.rates)
    return formatAmount(base, tripCurrency)
  }, [amount, canConvert, currency, fx, isForeign, tripCurrency])

  const blocked = isForeign && !canConvert

  async function onSubmit(values: CreateExpenseValues) {
    const amountCents = toCents(values.amount)
    let baseAmountCents = amountCents
    let fxRate = 1

    if (isForeign) {
      if (!fx) {
        Alert.alert('Rates unavailable', 'Exchange rates could not be loaded. Try again later.')
        return
      }
      try {
        baseAmountCents = convertCents(amountCents, currency, tripCurrency, fx.rates)
        fxRate = crossRate(currency, tripCurrency, fx.rates)
      } catch (error) {
        Alert.alert('Conversion failed', error instanceof Error ? error.message : 'Try again.')
        return
      }
    }

    try {
      await createExpense.mutateAsync({
        tripId,
        description: values.description,
        amountCents,
        currency,
        baseAmountCents,
        fxRate,
      })
      router.back()
    } catch (error) {
      Alert.alert(
        'Could not add expense',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  // Wait for the trip so the currency selector starts on the trip's own currency
  // (avoids the picker briefly defaulting to EUR while the trip loads).
  if (!trip) {
    return (
      <Screen title="Add expense">
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title="Add expense" scroll>
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextField
            label="Description"
            placeholder="Dinner"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.description?.message}
          />
        )}
      />

      <CurrencySelect
        label="Currency"
        value={currency}
        currencies={currencies}
        onChange={setPicked}
      />

      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <TextField
            label={`Amount (${currency})`}
            placeholder="45.00"
            keyboardType="decimal-pad"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.amount?.message}
          />
        )}
      />

      {preview ? <Text style={styles.preview}>≈ {preview}</Text> : null}
      {blocked ? (
        <Text style={styles.warn}>Exchange rate for {currency} is unavailable.</Text>
      ) : null}

      <Text style={styles.hint}>Split equally between all trip members.</Text>

      <Button
        label={createExpense.isPending ? 'Adding…' : 'Add expense'}
        onPress={handleSubmit(onSubmit)}
        disabled={createExpense.isPending || blocked}
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
  preview: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  warn: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
  },
  hint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
}))
