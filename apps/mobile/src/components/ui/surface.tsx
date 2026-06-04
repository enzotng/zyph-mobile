import type { ReactNode } from 'react'
import { type StyleProp, View, type ViewStyle } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'

type SurfaceProps = {
  children?: ReactNode
  radius?: number
  // Accepted for source-compatibility with the former Skia squircle; no effect on a
  // standard borderRadius.
  smoothing?: number
  // 'top' rounds only the top corners (e.g. a bottom sheet / card cover); 'all' is default.
  corners?: 'all' | 'top'
  color?: string
  borderColor?: string
  borderWidth?: number
  width?: number
  height?: number
  style?: StyleProp<ViewStyle>
}

// A rounded surface: a plain View with standard borderRadius (no Skia). Replaces the former
// Skia-drawn Squircle with the same prop API, so call sites are a rename only.
export function Surface({
  children,
  radius,
  corners = 'all',
  color,
  borderColor,
  borderWidth = 1,
  width,
  height,
  style,
}: SurfaceProps) {
  const { theme } = useUnistyles()
  const cornerRadius = radius ?? theme.radius.lg
  // borderCurve 'continuous' gives native iOS soft (squircle-like) corners, no Skia. It is
  // a no-op on Android and on full pills, and negligible below ~10px.
  const radiusStyle: ViewStyle =
    corners === 'top'
      ? {
          borderTopLeftRadius: cornerRadius,
          borderTopRightRadius: cornerRadius,
          borderCurve: 'continuous',
        }
      : { borderRadius: cornerRadius, borderCurve: 'continuous' }

  return (
    <View
      style={[
        radiusStyle,
        {
          backgroundColor: color ?? theme.colors.card,
          borderColor: borderColor ?? theme.colors.border,
          borderWidth,
          width,
          height,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
