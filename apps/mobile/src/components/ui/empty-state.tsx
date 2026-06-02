import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ZyphMark } from '@/components/brand/zyph-mark'
import { Button } from '@/components/button'
import { withAlpha } from '@/lib/color'

import { Squircle } from './squircle'

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
  cta?: string
  onCta?: () => void
}

export function EmptyState({ icon, title, body, cta, onCta }: EmptyStateProps) {
  const { theme } = useUnistyles()

  return (
    <View style={styles.container}>
      <Squircle
        style={styles.iconArea}
        color={withAlpha(theme.colors.primary, 0.1)}
        borderWidth={0}
        radius={theme.radius.lg}
      >
        <View style={styles.watermark}>
          <ZyphMark size={56} color={withAlpha(theme.colors.primary, 0.14)} />
        </View>
        <Ionicons name={icon} size={30} color={theme.colors.primary} />
      </Squircle>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      {cta !== undefined && <Button label={cta} onPress={onCta} block={false} />}
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
  watermark: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  body: {
    fontSize: theme.fontSize.md,
    color: theme.colors.muted,
    textAlign: 'center',
    maxWidth: 260,
  },
}))
