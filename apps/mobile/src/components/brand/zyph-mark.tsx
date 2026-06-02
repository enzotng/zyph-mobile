import { Ionicons } from '@expo/vector-icons'
import { useUnistyles } from 'react-native-unistyles'

type ZyphMarkProps = {
  size?: number
  color?: string
}

// ZYPH brand caret (upward chevron). Rendered as an Ionicon so it stays crisp at
// any size and needs no SVG/Skia dependency (test-safe). Swap for the exported
// brand SVG logo when one is available.
export function ZyphMark({ size = 40, color }: ZyphMarkProps) {
  const { theme } = useUnistyles()

  return <Ionicons name="chevron-up" size={size} color={color ?? theme.colors.primary} />
}
