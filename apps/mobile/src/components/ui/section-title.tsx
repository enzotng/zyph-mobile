import { type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

type SectionTitleProps = {
  children: ReactNode
  action?: string
  onAction?: () => void
}

export function SectionTitle({ children, action, onAction }: SectionTitleProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{children}</Text>
      {action != null && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.actionPressable, pressed && styles.pressed]}
        >
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: theme.gap(1),
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.foreground,
  },
  actionPressable: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  action: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
}))
