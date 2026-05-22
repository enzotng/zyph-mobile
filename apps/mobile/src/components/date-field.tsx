import DateTimePicker from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'

type DateFieldProps = {
  label: string
  value: Date
  onChange: (date: Date) => void
  error?: string | undefined
}

export function DateField({ label, value, onChange, error }: DateFieldProps) {
  const [open, setOpen] = useState(false)

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.input(Boolean(error))}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.value}>{value.toLocaleDateString()}</Text>
      </Pressable>
      {open ? (
        <>
          <DateTimePicker
            value={value}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(_event, date) => {
              // Android dialog closes on pick; iOS stays inline until "Done".
              if (Platform.OS === 'android') {
                setOpen(false)
              }
              if (date) {
                onChange(date)
              }
            }}
          />
          {Platform.OS === 'ios' ? (
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button">
              <Text style={styles.done}>Done</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.gap(1),
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
  done: {
    alignSelf: 'flex-end',
    paddingVertical: theme.gap(1),
    color: theme.colors.primary,
    fontWeight: '600',
  },
}))
