import type { ReactNode } from 'react'
import { ScrollView, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { AppHeader } from './app-header'

type ScreenProps = {
  title?: string
  showBack?: boolean
  right?: ReactNode
  // Wrap content in a ScrollView (forms); leave false for screens with their own list.
  scroll?: boolean
  children: ReactNode
}

export function Screen({ title, showBack, right, scroll = false, children }: ScreenProps) {
  return (
    <View style={styles.container}>
      <AppHeader title={title} showBack={showBack} right={right} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
}))
