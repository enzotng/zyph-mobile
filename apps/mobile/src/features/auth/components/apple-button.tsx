import * as AppleAuthentication from 'expo-apple-authentication'
import { Platform } from 'react-native'
import { StyleSheet, UnistylesRuntime, useUnistyles } from 'react-native-unistyles'

type AppleButtonProps = {
  onPress: () => void
  disabled?: boolean
}

// The native "Sign in with Apple" button (Apple requires their own button, auto-localised to the
// device). iOS only - renders nothing elsewhere. Style adapts to the active theme.
export function AppleButton({ onPress, disabled = false }: AppleButtonProps) {
  const { theme } = useUnistyles()

  if (Platform.OS !== 'ios') {
    return null
  }

  const buttonStyle =
    UnistylesRuntime.themeName === 'dark'
      ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
      : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={buttonStyle}
      cornerRadius={theme.radius.md}
      style={[styles.button, disabled && styles.disabled]}
      pointerEvents={disabled ? 'none' : 'auto'}
      accessibilityState={{ disabled }}
      onPress={() => {
        if (!disabled) {
          onPress()
        }
      }}
    />
  )
}

const styles = StyleSheet.create(() => ({
  button: {
    width: '100%',
    height: 48,
  },
  disabled: {
    opacity: 0.5,
  },
}))
