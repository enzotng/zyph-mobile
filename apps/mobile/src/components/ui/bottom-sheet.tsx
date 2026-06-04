import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { type LayoutChangeEvent, Modal, Pressable, Text, View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Surface } from './surface'

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

const SMOOTH_EASING = Easing.bezier(0.32, 0.72, 0, 1)
const OPEN_MS = 280
const CLOSE_MS = 240
// Off-screen travel used before the sheet has measured itself (first open only).
const FALLBACK_OFFSCREEN = 640

// A single shared value drives both the scrim opacity and the sheet translateY, so the
// scrim fades while the sheet slides (up on open, down on close). The Modal stays mounted
// until the close animation's callback unmounts it - the content is visible the whole time,
// so there is never an empty interactive overlay swallowing taps.
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const { theme } = useUnistyles()
  const [mounted, setMounted] = useState(open)
  const [sheetHeight, setSheetHeight] = useState(0)
  const progress = useSharedValue(0)

  if (open && !mounted) {
    setMounted(true)
  }

  useEffect(() => {
    if (open) {
      progress.value = withTiming(1, { duration: OPEN_MS, easing: SMOOTH_EASING })
      return
    }
    progress.value = withTiming(0, { duration: CLOSE_MS, easing: SMOOTH_EASING }, (finished) => {
      if (finished) {
        runOnJS(setMounted)(false)
      }
    })
  }, [open, progress])

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }))
  const sheetStyle = useAnimatedStyle(() => {
    const offscreen = sheetHeight > 0 ? sheetHeight : FALLBACK_OFFSCREEN
    return { transform: [{ translateY: (1 - progress.value) * offscreen }] }
  })

  function onSheetLayout(event: LayoutChangeEvent) {
    setSheetHeight(event.nativeEvent.layout.height)
  }

  if (!mounted) {
    return null
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.fill} pointerEvents={open ? 'auto' : 'none'}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable
            style={styles.scrimPress}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View style={sheetStyle} onLayout={onSheetLayout}>
          <Surface
            corners="top"
            color={theme.colors.background}
            borderWidth={0}
            radius={theme.radius.xl}
            style={styles.sheet}
          >
            <View style={styles.grabber} />
            {title !== undefined ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </Surface>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  fill: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  scrimPress: {
    flex: 1,
  },
  sheet: {
    maxHeight: rt.screen.height * 0.85,
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
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    color: theme.colors.foreground,
    marginBottom: theme.gap(3),
  },
}))
