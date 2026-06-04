import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { withAlpha } from '@/lib/color'

import { Surface } from './surface'

type ErrorStateProps = {
  title: string
  body: string
  retryLabel?: string
  onRetry?: () => void
  icon?: keyof typeof Ionicons.glyphMap
}

// Error counterpart of EmptyState: destructive-tinted icon + optional retry.
export function ErrorState({
  title,
  body,
  retryLabel,
  onRetry,
  icon = 'alert-circle-outline',
}: ErrorStateProps) {
  const { theme } = useUnistyles()

  return (
    <View style={styles.container}>
      <Surface
        style={styles.iconArea}
        color={withAlpha(theme.colors.destructive, 0.1)}
        borderWidth={0}
        radius={theme.radius.lg}
      >
        <Ionicons name={icon} size={30} color={theme.colors.destructive} />
      </Surface>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      {retryLabel !== undefined && onRetry !== undefined && (
        <View style={styles.ctaWrap}>
          <Button label={retryLabel} onPress={onRetry} icon="refresh" block={false} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.gap(4),
    paddingHorizontal: theme.gap(6),
  },
  iconArea: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  body: {
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.muted,
    textAlign: 'center',
    maxWidth: 260,
  },
  ctaWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
}))
