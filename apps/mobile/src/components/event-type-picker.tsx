import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Surface } from '@/components/ui'
import { EVENT_TYPES, type EventType, eventTypeIcon } from '@/features/timeline'
import { withAlpha } from '@/lib/color'

type EventTypePickerProps = {
  label: string
  value: string
  onChange: (value: EventType) => void
}

// A wrap of icon chips, one per canonical event type. `value` is the raw stored string, so
// a legacy/Smart-Import type simply highlights nothing until the user picks a canonical one.
export function EventTypePicker({ label, value, onChange }: EventTypePickerProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {EVENT_TYPES.map((type) => {
          const selected = type === value
          return (
            <Pressable
              key={type}
              onPress={() => onChange(type)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}
            >
              <Surface
                radius={theme.radius.md}
                color={selected ? withAlpha(theme.colors.primary, 0.12) : theme.colors.card}
                borderColor={selected ? theme.colors.primary : theme.colors.border}
                borderWidth={1.5}
                style={styles.chip}
              >
                <Ionicons
                  name={eventTypeIcon(type)}
                  size={18}
                  color={selected ? theme.colors.primary : theme.colors.muted}
                />
                <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>
                  {t(`events.types.${type}`)}
                </Text>
              </Surface>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(2),
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    fontFamily: theme.fonts.sans.semibold,
    color: theme.colors.foreground,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(2),
    paddingHorizontal: theme.gap(3),
  },
  chipLabel: {
    fontSize: theme.fontSize.sm,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    color: theme.colors.muted,
  },
  chipLabelActive: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
}))
