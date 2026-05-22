import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Platform, Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

type DateFieldProps = {
  label: string
  value: Date
  onChange: (date: Date) => void
  error?: string | undefined
}

export function DateField({ label, value, onChange, error }: DateFieldProps) {
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
      <Pressable
        style={styles.input(Boolean(error))}
        onPress={openAndroid}
        accessibilityRole="button"
      >
        <Text style={styles.value}>{value.toLocaleString()}</Text>
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
  input: (hasError: boolean) => ({
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: theme.gap(3),
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: hasError ? theme.colors.destructive : theme.colors.border,
    backgroundColor: theme.colors.card,
  }),
  value: {
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  error: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.destructive,
  },
}))
