import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { ActivityIndicator, Alert, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { CurrencySelect } from '@/components/currency-select'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { useFxRates } from '@/features/fx'
import {
  type UpdateProfileValues,
  updateProfileSchema,
  useProfile,
  useUpdateProfile,
} from '@/features/profile'

export default function EditProfileScreen() {
  const router = useRouter()
  const { data: profile, isLoading } = useProfile()
  const { data: fx } = useFxRates()
  const update = useUpdateProfile()

  const currencies = useMemo(() => {
    if (!fx) {
      return ['EUR']
    }
    return Object.keys(fx.rates).sort()
  }, [fx])

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    // RHF syncs from the loaded profile when it arrives; no useEffect needed.
    values: profile
      ? {
          displayName: profile.display_name ?? '',
          preferredCurrency: profile.preferred_currency,
        }
      : undefined,
    defaultValues: { displayName: '', preferredCurrency: 'EUR' },
  })

  async function onSubmit(values: UpdateProfileValues) {
    try {
      await update.mutateAsync(values)
      router.back()
    } catch (error) {
      Alert.alert(
        'Could not save profile',
        error instanceof Error ? error.message : 'Please try again.',
      )
    }
  }

  if (isLoading || !profile) {
    return (
      <Screen title="Edit profile" showBack>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title="Edit profile" scroll>
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="Name"
            placeholder="Your name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.displayName?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="preferredCurrency"
        render={({ field }) => (
          <CurrencySelect
            label="Preferred currency"
            value={field.value}
            currencies={currencies}
            onChange={field.onChange}
          />
        )}
      />

      <Button
        label={update.isPending ? 'Saving…' : 'Save changes'}
        onPress={handleSubmit(onSubmit)}
        disabled={update.isPending}
      />
    </Screen>
  )
}

const styles = StyleSheet.create(() => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
