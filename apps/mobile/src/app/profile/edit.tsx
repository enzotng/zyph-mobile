import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
  makeUpdateProfileSchema,
  type UpdateProfileValues,
  useProfile,
  useUpdateProfile,
} from '@/features/profile'

export default function EditProfileScreen() {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const router = useRouter()
  const { session } = useAuth()
  const { data: profile, isLoading } = useProfile()
  const { data: fx } = useFxRates()
  const update = useUpdateProfile()

  // React Compiler memoizes this automatically; a manual useMemo here trips
  // react-hooks/preserve-manual-memoization (it infers `profile`, not the property).
  const base = fx ? Object.keys(fx.rates) : ['EUR']
  const withCurrent = profile?.preferred_currency ? [profile.preferred_currency, ...base] : base
  const currencies = Array.from(new Set(withCurrent)).sort()

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileValues>({
    resolver: zodResolver(makeUpdateProfileSchema(t)),
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
        t('profile.saveErrorTitle'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  if (isLoading || !profile) {
    return (
      <Screen title={t('profile.editProfile')} showBack scroll>
        <View style={styles.center}>
          <Spinner label={t('common.loading')} />
        </View>
      </Screen>
    )
  }

  const displayName = watchedName?.trim()
    ? watchedName
    : (profile.display_name ?? t('profile.fallbackName'))

  return (
    <Screen title={t('profile.editProfile')} showBack scroll>
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
            label={t('profile.displayName')}
            placeholder={t('profile.namePlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.displayName?.message}
          />
        )}
      />

      <TextField
        label={t('profile.email')}
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
            label={t('profile.defaultCurrency')}
            value={field.value}
            currencies={currencies}
            onChange={field.onChange}
          />
        )}
      />

      <Button
        label={update.isPending ? t('common.saving') : t('common.save')}
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
