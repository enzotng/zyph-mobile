import {
  Canvas,
  Fill,
  Group,
  LinearGradient,
  Rect,
  Skia,
  Image as SkiaImage,
  useImage,
  vec,
} from '@shopify/react-native-skia'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  type LayoutChangeEvent,
  StyleSheet as RNStyleSheet,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native'
import { cancelAnimation, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useUnistyles } from 'react-native-unistyles'

import { type CornerRadii, squirclePoints } from '@/lib/squircle'

// Vibrant indigo/sky/teal family for the colour cover when no photo is available.
// (No dark slates - they blended into the dark background.)
const FALLBACK_TINTS = [
  '#4F46E5',
  '#6366F1',
  '#0EA5E9',
  '#0891B2',
  '#2563EB',
  '#0D9488',
  '#8B5CF6',
  '#DB2777',
]

// Deterministic so a given trip always gets the same cover colour across renders/sessions.
export function coverTint(seed: string | undefined): string {
  if (!seed) {
    return FALLBACK_TINTS[0]
  }
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return FALLBACK_TINTS[hash % FALLBACK_TINTS.length]
}

type CityImageProps = {
  // Photo URL; when absent, a deterministic colour cover is shown instead.
  uri?: string | null
  // Seed for the fallback tint (e.g. destination or title).
  seed?: string
  height: number
  radius?: number
  // 'top' rounds only the top corners (e.g. a card cover); 'all' is the default.
  corners?: 'all' | 'top'
  // Dark bottom gradient so white overlay text stays legible over a photo.
  scrim?: boolean
  // Overlay content (title, avatars, badges) positioned by the caller.
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

// The photo, fallback tint, loading shimmer and scrim are all drawn inside one Skia
// Canvas clipped to a superellipse path - so the cover matches the Card's squircle
// exactly (no RN borderRadius vs Skia mismatch) and its bottom sits flush with content.
export function CityImage({
  uri,
  seed,
  height,
  radius,
  corners = 'all',
  scrim = true,
  children,
  style,
}: CityImageProps) {
  const { theme } = useUnistyles()
  const cornerRadius = radius ?? theme.radius.lg
  const [width, setWidth] = useState(0)
  const image = useImage(uri ?? null)
  const isLoading = Boolean(uri) && image === null
  const shimmer = useSharedValue(0.16)

  useEffect(() => {
    if (isLoading) {
      shimmer.value = withRepeat(withTiming(0.4, { duration: 850 }), -1, true)
    } else {
      cancelAnimation(shimmer)
    }
  }, [isLoading, shimmer])

  const clip = useMemo(() => {
    if (width === 0) {
      return null
    }
    const spec: number | Partial<CornerRadii> =
      corners === 'top'
        ? { topLeft: cornerRadius, topRight: cornerRadius, bottomRight: 0, bottomLeft: 0 }
        : cornerRadius
    const points = squirclePoints(width, height, spec, 8, 0)
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
  }, [width, height, cornerRadius, corners])

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width)
  }

  return (
    <View onLayout={onLayout} style={[{ height }, style]}>
      {clip ? (
        <Canvas style={RNStyleSheet.absoluteFill}>
          <Group clip={clip}>
            <Fill color={coverTint(seed)} />
            {image ? (
              <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="cover" />
            ) : null}
            {isLoading ? <Fill color="#FFFFFF" opacity={shimmer} /> : null}
            {scrim && image ? (
              <Rect x={0} y={0} width={width} height={height}>
                <LinearGradient
                  start={vec(0, 0)}
                  end={vec(0, height)}
                  positions={[0.35, 1]}
                  colors={['rgba(15, 23, 42, 0)', 'rgba(15, 23, 42, 0.82)']}
                />
              </Rect>
            ) : null}
          </Group>
        </Canvas>
      ) : null}
      {children}
    </View>
  )
}
