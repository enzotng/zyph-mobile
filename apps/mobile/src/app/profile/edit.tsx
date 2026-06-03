import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Alert, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { CurrencySelect } from '@/components/currency-select'
import { Screen } from '@/components/screen'
import { TextField } from '@/components/text-field'
import { Avatar, Spinner } from '@/components/ui'
import { useAuth } from '@/features/auth'
import { useFxRates } from '@/features/fx'
import {
  type UpdateProfileValues,
  updateProfileSchema,
  useProfile,
  useUpdateProfile,
} from '@/features/profile'

export default function EditProfileScreen() {
  const { theme } = useUnistyles()
  const router = useRouter()
  const { session } = useAuth()
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

  const watchedName = useWatch({ control, name: 'displayName' })

  async function onSubmit(values: UpdateProfileValues) {
    try {
      await update.mutateAsync(values)
      router.back()
    } catch (error) {
      Alert.alert(
        'Enregistrement impossible',
        error instanceof Error ? error.message : 'Veuillez réessayer.',
      )
    }
  }

  if (isLoading || !profile) {
    return (
      <Screen title="Modifier le profil" showBack scroll>
        <View style={styles.center}>
          <Spinner label="Chargement…" />
        </View>
      </Screen>
    )
  }

  const displayName = watchedName?.trim() ? watchedName : (profile.display_name ?? 'Profil')

  return (
    <Screen title="Modifier le profil" showBack scroll>
      {/* Avatar hero */}
      <View style={styles.avatarWrap}>
        <View style={styles.avatarStack}>
          <Avatar name={displayName} size={84} tint={theme.colors.primary} />
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={15} color="#FFFFFF" />
          </View>
        </View>
      </View>

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="Nom affiché"
            placeholder="Votre nom"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.displayName?.message}
          />
        )}
      />

      <TextField
        label="E-mail"
        value={session?.user.email ?? ''}
        editable={false}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Controller
        control={control}
        name="preferredCurrency"
        render={({ field }) => (
          <CurrencySelect
            label="Devise par défaut"
            value={field.value}
            currencies={currencies}
            onChange={field.onChange}
          />
        )}
      />

      <Button
        label={update.isPending ? 'Enregistrement…' : 'Enregistrer'}
        onPress={handleSubmit(onSubmit)}
        disabled={update.isPending}
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
  avatarWrap: {
    alignItems: 'center',
  },
  avatarStack: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 3,
    borderColor: theme.colors.background,
    backgroundColor: theme.colors.primary,
  },
}))
