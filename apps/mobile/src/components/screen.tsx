import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { AppHeader } from './app-header'

type ScreenProps = {
  title?: string
  showBack?: boolean
  right?: ReactNode
  // Wrap content in a ScrollView (forms); leave false for screens with their own list.
  scroll?: boolean
  // A pinned bottom area (e.g. the primary action button). Stays above the keyboard and the
  // safe area, with a top divider - so every form's submit button is consistently sticky.
  footer?: ReactNode
  children: ReactNode
}

// Lifts the sticky footer above the keyboard. iOS reports the keyboard height; on Android
// (windowSoftInputMode=adjustResize) it stays ~0 because the window itself resizes, so the
// worklet lifts on iOS and is a no-op on Android. Subtract the bottom inset the footer already
// pads with, so the lifted footer sits flush above the keyboard. Split out so the keyboard
// subscription only mounts on screens that actually have a footer.
function KeyboardFooter({ children }: { children: ReactNode }) {
  const { rt } = useUnistyles()
  const insetsBottom = rt.insets.bottom
  const keyboard = useAnimatedKeyboard()
  const footerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboard.height.value - insetsBottom) }],
  }))
  return <Animated.View style={[styles.footer, footerStyle]}>{children}</Animated.View>
}

export function Screen({ title, showBack, right, scroll = false, footer, children }: ScreenProps) {
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, footer != null && styles.scrollContentFooter]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      // iOS: inset for the keyboard and scroll the focused field into view (no-op on Android,
      // which resizes the window instead).
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  )

  return (
    <View style={styles.container}>
      <AppHeader title={title} showBack={showBack} right={right} />
      {body}
      {footer != null ? <KeyboardFooter>{footer}</KeyboardFooter> : null}
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(2),
  },
  scrollContent: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(4),
    paddingBottom: rt.insets.bottom + theme.gap(6),
    gap: theme.gap(4),
  },
  // With a sticky footer the bottom inset lives on the footer. The extra bottom space also lets
  // a keyboard-focused field scroll clear of the footer once it lifts above the keyboard.
  scrollContentFooter: {
    paddingBottom: theme.gap(8),
  },
  footer: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(3),
    paddingBottom: rt.insets.bottom + theme.gap(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
}))
