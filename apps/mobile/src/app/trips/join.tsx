import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { TextField } from '@/components/text-field'
import { type JoinTripValues, joinTripSchema, useJoinTrip } from '@/features/group'

export default function JoinTripScreen() {
  const router = useRouter()
  const joinTrip = useJoinTrip()
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinTripValues>({
    resolver: zodResolver(joinTripSchema),
    defaultValues: { code: '' },
  })

  async function onSubmit(values: JoinTripValues) {
    try {
      const tripId = await joinTrip.mutateAsync(values.code)
      router.replace({ pathname: '/trips/[id]', params: { id: tripId } })
    } catch (error) {
      Alert.alert(
        'Could not join trip',
        error instanceof Error ? error.message : 'Check the code and try again.',
      )
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a trip</Text>

      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="Invite code"
            autoCapitalize="none"
            placeholder="e.g. a1b2c3d4e5f6"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.code?.message}
          />
        )}
      />

      <Button
        label={joinTrip.isPending ? 'Joining…' : 'Join'}
        onPress={handleSubmit(onSubmit)}
        disabled={joinTrip.isPending}
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
