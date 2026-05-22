import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { Alert } from 'react-native'

import { Button } from '@/components/button'
import { DateField } from '@/components/date-field'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { type CreateEventValues, createEventSchema, useCreateEvent } from '@/features/timeline'

export default function AddEventScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? ''
  const router = useRouter()
  const createEvent = useCreateEvent(tripId)
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEventValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: { title: '', startsAt: new Date().toISOString(), notes: '' },
  })

  async function onSubmit(values: CreateEventValues) {
    try {
      await createEvent.mutateAsync({
        tripId,
        title: values.title,
        startsAt: values.startsAt,
        notes: values.notes,
      })
      router.back()
    } catch (error) {
      Alert.alert(
        'Could not add event',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  return (
    <Screen title="Add event" scroll>
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextField
            label="Title"
            placeholder="Flight to Rome"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.title?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="startsAt"
        render={({ field }) => (
          <DateField
            label="Date"
            value={new Date(field.value)}
            onChange={(date) => field.onChange(date.toISOString())}
            error={errors.startsAt?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextField
            label="Notes"
            placeholder="Optional"
            multiline
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.notes?.message}
          />
        )}
      />

      <Button
        label={createEvent.isPending ? 'Adding…' : 'Add event'}
        onPress={handleSubmit(onSubmit)}
        disabled={createEvent.isPending}
      />
    </Screen>
  )
}
