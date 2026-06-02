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
  // Provide both to skip onLayout measurement - a perf win for fixed-size, per-row tiles.
  width?: number
  height?: number
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
  width,
  height,
  style,
}: SquircleProps) {
  const { theme } = useUnistyles()
  const hasFixedSize = width !== undefined && height !== undefined
  const [measured, setMeasured] = useState({ width: 0, height: 0 })
  const size = width !== undefined && height !== undefined ? { width, height } : measured

  const baseRadius = radius ?? theme.radius.lg
  const fill = color ?? theme.colors.card
  const stroke = borderColor ?? theme.colors.border

  function onLayout(event: LayoutChangeEvent) {
    const layout = event.nativeEvent.layout
    setMeasured({ width: layout.width, height: layout.height })
  }

  // One outline serves both the fill and the centered stroke (rebuilt only when the
  // geometry changes). Inset by half the border width so the stroke is not clipped at
  // the canvas edge. The radius spec is derived inline so the memo deps stay primitive.
  const path = useMemo(() => {
    if (size.width === 0) {
      return null
    }
    const spec: number | Partial<CornerRadii> =
      corners === 'top'
        ? { topLeft: baseRadius, topRight: baseRadius, bottomRight: 0, bottomLeft: 0 }
        : baseRadius
    return buildPath(
      size.width,
      size.height,
      spec,
      smoothing,
      borderWidth > 0 ? borderWidth / 2 : 0,
    )
  }, [size.width, size.height, baseRadius, corners, smoothing, borderWidth])

  return (
    <View style={style} onLayout={hasFixedSize ? undefined : onLayout}>
      {path ? (
        <Canvas style={styles.canvas}>
          <Path path={path} color={fill} />
          {borderWidth > 0 ? (
            <Path path={path} style="stroke" strokeWidth={borderWidth} color={stroke} />
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
