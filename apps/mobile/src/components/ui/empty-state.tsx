import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { ZyphMark } from '@/components/brand/zyph-mark'
import { Button } from '@/components/button'
import { withAlpha } from '@/lib/color'

import { Surface } from './surface'

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
  cta?: string
  onCta?: () => void
  secondaryCta?: string
  onSecondaryCta?: () => void
}

export function EmptyState({
  icon,
  title,
  body,
  cta,
  onCta,
  secondaryCta,
  onSecondaryCta,
}: EmptyStateProps) {
  const { theme } = useUnistyles()

  return (
    <View style={styles.container}>
      <Surface
        style={styles.iconArea}
        color={withAlpha(theme.colors.primary, 0.1)}
        borderWidth={0}
        radius={theme.radius.lg}
      >
        <View style={styles.watermark}>
          <ZyphMark size={56} color={withAlpha(theme.colors.primary, 0.14)} />
        </View>
        <Ionicons name={icon} size={30} color={theme.colors.primary} />
      </Surface>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      {cta !== undefined && (
        <View style={styles.ctaWrap}>
          <Button label={cta} onPress={onCta} />
          {secondaryCta !== undefined && (
            <Button label={secondaryCta} onPress={onSecondaryCta} variant="secondary" />
          )}
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
  watermark: {
    position: 'absolute',
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
  // Full-width stacked buttons (primary then secondary), the single create/join CTA convention
  // shared with the AddTripSheet so the layout never shifts between states.
  ctaWrap: {
    alignSelf: 'stretch',
    gap: theme.gap(2),
  },
}))
