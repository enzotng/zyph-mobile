import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Text } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import {
  type CreateExpenseValues,
  createExpenseSchema,
  toCents,
  useCreateExpense,
} from '@/features/expenses'
import { useTrip } from '@/features/trips'

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? ''
  const router = useRouter()
  const { data: trip } = useTrip(tripId)
  const createExpense = useCreateExpense(tripId)
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateExpenseValues>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: { description: '', amount: '' },
  })

  async function onSubmit(values: CreateExpenseValues) {
    try {
      await createExpense.mutateAsync({
        tripId,
        description: values.description,
        amountCents: toCents(values.amount),
        currency: trip?.currency ?? 'EUR',
      })
      router.back()
    } catch (error) {
      Alert.alert(
        'Could not add expense',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
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

      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <TextField
            label={`Amount (${trip?.currency ?? 'EUR'})`}
            placeholder="45.00"
            keyboardType="decimal-pad"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.amount?.message}
          />
        )}
      />

      <Text style={styles.hint}>Split equally between all trip members.</Text>

      <Button
        label={createExpense.isPending ? 'Adding…' : 'Add expense'}
        onPress={handleSubmit(onSubmit)}
        disabled={createExpense.isPending}
      />
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  hint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
}))
