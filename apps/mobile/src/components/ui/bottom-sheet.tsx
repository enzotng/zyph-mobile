import type { ReactNode } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Squircle } from './squircle'

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const { theme } = useUnistyles()

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        {/* Inner Pressable blocks propagation so tapping the sheet does not close it. */}
        <Pressable onPress={() => undefined}>
          <Squircle
            corners="top"
            radius={theme.radius.xl}
            color={theme.colors.background}
            borderWidth={0}
            style={styles.sheet}
          >
            <View style={styles.grabber} />
            {title !== undefined ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </Squircle>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: theme.gap(5),
    paddingBottom: rt.insets.bottom + theme.gap(5),
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.gap(3),
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.foreground,
    marginBottom: theme.gap(3),
  },
}))
