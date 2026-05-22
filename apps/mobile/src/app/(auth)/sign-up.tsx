import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useRouter } from 'expo-router'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Alert, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { TextField } from '@/components/text-field'
import { type SignUpValues, signUp, signUpSchema } from '@/features/auth'

export default function SignUpScreen() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  })

  async function onSubmit(values: SignUpValues) {
    setSubmitting(true)
    try {
      const { session } = await signUp(values)
      // With email confirmation enabled there is no session yet -> ask to confirm.
      // If a session exists (confirmation disabled), the auth gate routes home.
      if (!session) {
        router.replace('/(auth)/check-email')
      }
    } catch (error) {
      Alert.alert('Sign up failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your account</Text>

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="Name"
            autoCapitalize="words"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.displayName?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Password"
            secureTextEntry
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />

      <Button
        label={submitting ? 'Creating…' : 'Sign up'}
        onPress={handleSubmit(onSubmit)}
        disabled={submitting}
      />

      <View style={styles.footer}>
        <Text style={styles.muted}>Already have an account?</Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          Sign in
        </Link>
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.gap(4),
    paddingHorizontal: theme.gap(6),
    paddingTop: rt.insets.top,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.gap(1),
  },
  muted: {
    color: theme.colors.muted,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
}))
