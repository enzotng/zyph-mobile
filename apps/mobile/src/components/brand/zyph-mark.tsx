import { Canvas, Path } from '@shopify/react-native-skia'
import { useUnistyles } from 'react-native-unistyles'

type ZyphMarkProps = {
  size?: number
  color?: string
}

// The exported ZYPH brand mark, as its raw SVG path (viewBox 52x40).
const LOGO_PATH =
  'M24.0567 0.0760429C28.1847 -0.0419571 42.3087 -0.73096 41.1497 5.98504C40.0437 12.394 27.7987 18.892 22.7697 22.766C36.1837 23.057 42.9707 23.9131 51.2377 11.5911C51.2737 12.7941 51.2897 13.998 51.2837 15.201C51.2267 30.362 44.1267 38.8881 28.6967 38.8721C23.1697 38.9741 9.6987 40.9051 11.4387 30.2441C12.5187 23.6211 23.6426 20.1531 29.1206 16.0001C16.4236 14.2781 7.34967 15.527 0.0286683 27.126C-0.470332 9.15803 5.46568 0.797043 24.0567 0.0760429Z'
const VIEWBOX_W = 52
const VIEWBOX_H = 40

// ZYPH brand mark, drawn from the exported SVG path via Skia so it stays crisp at any size and
// can be tinted. `size` is the mark height; width keeps the 52:40 aspect ratio.
export function ZyphMark({ size = 40, color }: ZyphMarkProps) {
  const { theme } = useUnistyles()
  const scale = size / VIEWBOX_H

  return (
    <Canvas style={{ width: VIEWBOX_W * scale, height: size }}>
      <Path path={LOGO_PATH} color={color ?? theme.colors.primary} transform={[{ scale }]} />
    </Canvas>
  )
}
