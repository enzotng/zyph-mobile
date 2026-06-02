import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { type CornerRadii, squirclePoints } from '@/lib/squircle'

function buildPath(
  width: number,
  height: number,
  radius: number | Partial<CornerRadii>,
  smoothing: number,
  inset: number,
) {
  const points = squirclePoints(width, height, radius, smoothing, inset)
  const path = Skia.Path.Make()
  points.forEach((point, index) => {
    if (index === 0) {
      path.moveTo(point.x, point.y)
    } else {
      path.lineTo(point.x, point.y)
    }
  })
  path.close()
  return path
}

type SquircleProps = {
  children?: ReactNode
  // Corner radius (defaults to the lg token). Smoothing is the superellipse exponent.
  radius?: number
  smoothing?: number
  // 'top' rounds only the top corners (e.g. a bottom sheet); 'all' is the default.
  corners?: 'all' | 'top'
  // Fill + border colors (default to the card/border tokens). borderWidth 0 hides the border.
  color?: string
  borderColor?: string
  borderWidth?: number
  style?: StyleProp<ViewStyle>
}

// A squircle surface: a Skia-drawn superellipse-cornered rectangle behind its children.
// Measures itself via onLayout, so it adapts to any content size.
export function Squircle({
  children,
  radius,
  smoothing = 8,
  corners = 'all',
  color,
  borderColor,
  borderWidth = 1,
  style,
}: SquircleProps) {
  const { theme } = useUnistyles()
  const [size, setSize] = useState({ width: 0, height: 0 })

  const baseRadius = radius ?? theme.radius.lg
  const fill = color ?? theme.colors.card
  const stroke = borderColor ?? theme.colors.border

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout
    setSize({ width, height })
  }

  // Rebuild the Skia paths only when the geometry changes, not on every render.
  // The radius spec is derived inline so the memo deps stay primitive.
  const fillPath = useMemo(() => {
    if (size.width === 0) {
      return null
    }
    const spec: number | Partial<CornerRadii> =
      corners === 'top'
        ? { topLeft: baseRadius, topRight: baseRadius, bottomRight: 0, bottomLeft: 0 }
        : baseRadius
    return buildPath(size.width, size.height, spec, smoothing, 0)
  }, [size.width, size.height, baseRadius, corners, smoothing])

  const borderPath = useMemo(() => {
    if (size.width === 0 || borderWidth <= 0) {
      return null
    }
    const spec: number | Partial<CornerRadii> =
      corners === 'top'
        ? { topLeft: baseRadius, topRight: baseRadius, bottomRight: 0, bottomLeft: 0 }
        : baseRadius
    return buildPath(size.width, size.height, spec, smoothing, borderWidth / 2)
  }, [size.width, size.height, baseRadius, corners, smoothing, borderWidth])

  return (
    <View style={style} onLayout={onLayout}>
      {fillPath ? (
        <Canvas style={styles.canvas}>
          <Path path={fillPath} color={fill} />
          {borderPath ? (
            <Path path={borderPath} style="stroke" strokeWidth={borderWidth} color={stroke} />
          ) : null}
        </Canvas>
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create(() => ({
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}))
