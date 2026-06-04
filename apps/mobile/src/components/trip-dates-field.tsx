import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { DateField } from '@/components/date-field'
import { dateToIsoDay, isoDayToDate } from '@/features/trips'

type TripDatesValue = { startDate: string | null; endDate: string | null }

type TripDatesFieldProps = {
  startDate: string | null
  endDate: string | null
  onChange: (next: TripDatesValue) => void
  error?: string | undefined
}

// Optional travel dates as a single composite field. Values are 'YYYY-MM-DD' strings (or
// null when unset); this component handles the Date <-> string conversion for the native
// picker. The end date is clamped to start (minimumDate + a bump on start change), so the
// schema's end >= start refine is never reached from the UI.
export function TripDatesField({ startDate, endDate, onChange, error }: TripDatesFieldProps) {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const enabled = startDate !== null

  function toggle() {
    if (enabled) {
      onChange({ startDate: null, endDate: null })
      return
    }
    const today = dateToIsoDay(new Date())
    onChange({ startDate: today, endDate: today })
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.toggle}
        onPress={toggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: enabled }}
      >
        <Ionicons
          name={enabled ? 'checkbox' : 'square-outline'}
          size={22}
          color={enabled ? theme.colors.primary : theme.colors.muted}
        />
        <Text style={styles.toggleLabel}>{t('tripForm.addDates')}</Text>
      </Pressable>

      {enabled && startDate ? (
        <View style={styles.fields}>
          <DateField
            label={t('tripForm.startDate')}
            mode="date"
            value={isoDayToDate(startDate)}
            onChange={(date) => {
              const nextStart = dateToIsoDay(date)
              // Keep the end on or after the start.
              const nextEnd = endDate && endDate < nextStart ? nextStart : endDate
              onChange({ startDate: nextStart, endDate: nextEnd })
            }}
          />
          <DateField
            label={t('tripForm.endDate')}
            mode="date"
            minimumDate={isoDayToDate(startDate)}
            value={isoDayToDate(endDate ?? startDate)}
            onChange={(date) => onChange({ startDate, endDate: dateToIsoDay(date) })}
            error={error}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(3),
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  toggleLabel: {
    fontSize: theme.fontSize.md,
    fontFamily: theme.fonts.sans.regular,
    color: theme.colors.foreground,
  },
  fields: {
    gap: theme.gap(4),
  },
}))
