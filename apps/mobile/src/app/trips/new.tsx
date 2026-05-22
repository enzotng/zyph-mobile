import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { TextField } from '@/components/text-field'
import { type CreateTripValues, createTripSchema, useCreateTrip } from '@/features/trips'

export default function NewTripScreen() {
  const router = useRouter()
  const createTrip = useCreateTrip()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(createTripSchema),
    defaultValues: { title: '', destination: '', currency: 'EUR' },
  })

  async function onSubmit(values: CreateTripValues) {
    try {
      const trip = await createTrip.mutateAsync(values)
      router.replace({ pathname: '/trips/[id]', params: { id: trip.id } })
    } catch (error) {
      Alert.alert(
        'Could not create trip',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New trip</Text>

      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextField
            label="Title"
            placeholder="Weekend in Rome"
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
            placeholder="Rome, Italy"
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
        label={createTrip.isPending ? 'Creating…' : 'Create trip'}
        onPress={handleSubmit(onSubmit)}
        disabled={createTrip.isPending}
      />
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    gap: theme.gap(4),
    paddingHorizontal: theme.gap(6),
    paddingTop: rt.insets.top + theme.gap(4),
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
}))
