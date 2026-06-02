import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Platform, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Squircle } from '@/components/ui/squircle'

type DateFieldProps = {
  label: string
  value: Date
  onChange: (date: Date) => void
  error?: string | undefined
}

export function DateField({ label, value, onChange, error }: DateFieldProps) {
  const { theme } = useUnistyles()

  // iOS: the native compact control — a tappable date/time chip that pops the system
  // popover. mode="datetime" lets the user set both the day and the time.
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.container}>
        <View style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            onChange={(_event, date) => {
              if (date) {
                onChange(date)
              }
            }}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    )
  }

  // Android: open the native date dialog, then the native time dialog (Android has no
  // single date+time dialog), preserving the picked day when selecting the time.
  function openAndroid() {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      onChange: (_dateEvent, pickedDate) => {
        if (!pickedDate) {
          return
        }
        DateTimePickerAndroid.open({
          value: pickedDate,
          mode: 'time',
          onChange: (_timeEvent, pickedDateTime) => {
            if (pickedDateTime) {
              onChange(pickedDateTime)
            }
          },
        })
      },
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={openAndroid} accessibilityRole="button">
        <Squircle
          radius={theme.radius.md}
          color={theme.colors.card}
          borderColor={error ? theme.colors.destructive : theme.colors.border}
          style={styles.input}
        >
          <Text style={styles.value}>{value.toLocaleString()}</Text>
        </Squircle>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(1),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  input: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: theme.gap(3),
  },
  value: {
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  error: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.destructive,
  },
}))
