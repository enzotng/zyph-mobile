import type { ReactNode } from 'react'
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

import { Squircle } from './squircle'

type CardProps = {
  children: ReactNode
  onPress?: () => void
  padding?: number
  style?: StyleProp<ViewStyle>
}

export function Card({ children, onPress, padding, style }: CardProps) {
  const body = <View style={[styles.body, padding !== undefined && { padding }]}>{children}</View>

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}
      >
        <Squircle style={style}>{body}</Squircle>
      </Pressable>
    )
  }

  return <Squircle style={style}>{body}</Squircle>
}

const styles = StyleSheet.create((theme) => ({
  body: {
    padding: theme.gap(4),
  },
  pressed: {
    opacity: 0.85,
  },
}))
