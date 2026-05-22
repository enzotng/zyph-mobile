import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Pressable, Text } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { DateField } from '@/components/date-field'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { type CreateEventValues, createEventSchema, useCreateEvent } from '@/features/timeline'
import { paramString } from '@/lib/routing'

const ONE_HOUR_MS = 3_600_000

export default function AddEventScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const createEvent = useCreateEvent(tripId)
  const [hasEnd, setHasEnd] = useState(false)

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CreateEventValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: { title: '', startsAt: new Date().toISOString(), endsAt: '', notes: '' },
  })

  function toggleEnd() {
    // Keep form side effects out of the state updater (it can run twice in Strict Mode).
    const next = !hasEnd
    setHasEnd(next)
    if (next && !getValues('endsAt')) {
      const start = new Date(getValues('startsAt'))
      setValue('endsAt', new Date(start.getTime() + ONE_HOUR_MS).toISOString())
    } else if (!next) {
      setValue('endsAt', '')
    }
  }

  async function onSubmit(values: CreateEventValues) {
    try {
      await createEvent.mutateAsync({
        tripId,
        title: values.title,
        startsAt: values.startsAt,
        endsAt: values.endsAt || undefined,
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
            label="Start"
            value={new Date(field.value)}
            onChange={(date) => field.onChange(date.toISOString())}
            error={errors.startsAt?.message}
          />
        )}
      />

      <Pressable
        style={styles.toggle}
        onPress={toggleEnd}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasEnd }}
      >
        <Ionicons
          name={hasEnd ? 'checkbox' : 'square-outline'}
          size={22}
          color={hasEnd ? theme.colors.primary : theme.colors.muted}
        />
        <Text style={styles.toggleLabel}>Add an end time</Text>
      </Pressable>

      {hasEnd ? (
        <Controller
          control={control}
          name="endsAt"
          render={({ field }) => (
            <DateField
              label="End"
              value={new Date(field.value || getValues('startsAt'))}
              onChange={(date) => field.onChange(date.toISOString())}
              error={errors.endsAt?.message}
            />
          )}
        />
      ) : null}

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

const styles = StyleSheet.create((theme) => ({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  toggleLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
}))
