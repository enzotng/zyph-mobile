import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { AppHeader } from './app-header'

// Approx. AppHeader content height below the safe-area top inset, for the keyboard offset.
const HEADER_HEIGHT = 52

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

export function Screen({ title, showBack, right, scroll = false, footer, children }: ScreenProps) {
  const { rt } = useUnistyles()

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, footer != null && styles.scrollContentFooter]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  )

  if (footer == null) {
    return (
      <View style={styles.container}>
        <AppHeader title={title} showBack={showBack} right={right} />
        {body}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <AppHeader title={title} showBack={showBack} right={right} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={rt.insets.top + HEADER_HEIGHT}
      >
        {body}
        <View style={styles.footer}>{footer}</View>
      </KeyboardAvoidingView>
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
  // With a sticky footer the bottom inset lives on the footer, so the scroll only needs a
  // small gap above it.
  scrollContentFooter: {
    paddingBottom: theme.gap(4),
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
