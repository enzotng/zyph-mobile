import { Ionicons } from '@expo/vector-icons'

// Legacy: retained for the copilot itinerary picker until the Lot 3 copilot upgrade; timeline,
// forms, and display use src/features/taxonomy.
// The canonical, user-selectable event types. Order = picker order.
export const EVENT_TYPES = ['flight', 'lodging', 'transport', 'activity', 'food', 'event'] as const

export type EventType = (typeof EVENT_TYPES)[number]

// Icon per stored type. Includes aliases for types produced elsewhere (Smart Import emits
// 'hotel') so every stored event resolves to a real icon, never the fallback.
const EVENT_TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  flight: 'airplane',
  lodging: 'bed',
  hotel: 'bed',
  transport: 'car',
  activity: 'ticket',
  food: 'restaurant',
  event: 'calendar',
}

export function eventTypeIcon(type: string | null | undefined): keyof typeof Ionicons.glyphMap {
  return (type && EVENT_TYPE_ICON[type]) || 'calendar'
}
