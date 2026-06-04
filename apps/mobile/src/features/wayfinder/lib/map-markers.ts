import type { WayfinderTargetKind } from '../hooks/use-wayfinder-targets'

// The toggleable map layers. Gates ride the events layer (a gate belongs to an event).
export type MapLayer = 'event' | 'poi' | 'member'

export function layerOf(kind: WayfinderTargetKind): MapLayer {
  return kind === 'gate' ? 'event' : kind
}

type LayerColors = { primary: string; accent: string; success: string }

// Tint per layer: events/gates use primary (indigo), places use accent (sky), members success (green).
export function mapTintFor(colors: LayerColors, kind: WayfinderTargetKind): string {
  const layer = layerOf(kind)
  if (layer === 'poi') {
    return colors.accent
  }
  if (layer === 'member') {
    return colors.success
  }
  return colors.primary
}

// POI icon key -> SF Symbol (iOS). Falls back to a pin for unknown/legacy values.
const POI_SF_SYMBOL: Record<string, string> = {
  pin: 'mappin',
  gate: 'airplane',
  bag: 'bag.fill',
  food: 'fork.knife',
  wc: 'drop.fill',
  cash: 'dollarsign.circle.fill',
  taxi: 'car.fill',
  wifi: 'wifi',
  star: 'star.fill',
}

export function sfSymbolForPoiIcon(icon: string): string {
  return POI_SF_SYMBOL[icon] ?? 'mappin'
}

// SF Symbol per marker: events/gates/members are fixed per kind; POIs use their own icon.
export function mapSymbolFor(kind: WayfinderTargetKind, icon: string): string {
  switch (kind) {
    case 'event':
      return 'calendar'
    case 'gate':
      return 'airplane'
    case 'member':
      return 'person.fill'
    default:
      return sfSymbolForPoiIcon(icon)
  }
}
