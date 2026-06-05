import { useEffect } from 'react'
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { withAlpha } from '@/lib/color'

type SkeletonProps = {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

// A pulsing placeholder block for loading states. One opacity loop, driven by a reanimated
// mount animation (the useEffect shared-value mutation mirrors the existing TabPill pattern
// and is react-compiler safe - the value is never mutated from a React event handler).
export function Skeleton({ width = '100%', height = 16, radius, style }: SkeletonProps) {
  const { theme } = useUnistyles()
  const pulse = useSharedValue(0.4)

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [pulse])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: radius ?? theme.radius.sm },
        animatedStyle,
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create((theme) => ({
  block: {
    backgroundColor: withAlpha(theme.colors.muted, 0.22),
  },
}))
