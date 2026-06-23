import { Text, type TextProps } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

// Canonical section overline ("eyebrow"): bold uppercase muted micro-label above a section.
// Wraps Text so every site shares one spec; the passed `style` overrides the defaults last, so a
// site can recolour it (e.g. the on-bezel cream) without re-declaring the type metrics.
export function Eyebrow({ style, ...rest }: TextProps) {
  return <Text style={[styles.eyebrow, style]} {...rest} />
}

const styles = StyleSheet.create((theme) => ({
  eyebrow: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
}))
