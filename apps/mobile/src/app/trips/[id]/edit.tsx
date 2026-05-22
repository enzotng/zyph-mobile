import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { ActivityIndicator, Alert, Text } from 'react-native'

import { Button } from '@/components/button'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { type CreateTripValues, createTripSchema, useTrip, useUpdateTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

export default function EditTripScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { data: trip, isLoading } = useTrip(tripId)
  const updateTrip = useUpdateTrip()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(createTripSchema),
    values: trip
      ? { title: trip.title, destination: trip.destination ?? '', currency: trip.currency }
      : { title: '', destination: '', currency: 'EUR' },
  })

  async function onSubmit(values: CreateTripValues) {
    try {
      await updateTrip.mutateAsync({ id: tripId, ...values })
      router.back()
    } catch (error) {
      Alert.alert(
        'Could not update trip',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  if (isLoading) {
    return (
      <Screen title="Edit trip">
        <ActivityIndicator />
      </Screen>
    )
  }

  if (!trip) {
    return (
      <Screen showBack>
        <Text>Trip not found.</Text>
      </Screen>
    )
  }

  return (
    <Screen title="Edit trip" scroll>
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextField
            label="Title"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.title?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="destination"
        render={({ field }) => (
          <TextField
            label="Destination"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.destination?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="currency"
        render={({ field }) => (
          <TextField
            label="Currency"
            autoCapitalize="characters"
            maxLength={3}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.currency?.message}
          />
        )}
      />

      <Button
        label={updateTrip.isPending ? 'Saving…' : 'Save changes'}
        onPress={handleSubmit(onSubmit)}
        disabled={updateTrip.isPending}
      />
    </Screen>
  )
}
