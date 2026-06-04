import { fireEvent, render, screen } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { DateField } from './date-field'

jest.mock('@react-native-community/datetimepicker', () => {
  const openMock = jest.fn()
  return {
    __esModule: true,
    default: jest.fn(() => null),
    DateTimePickerAndroid: { open: openMock, __openMock: openMock },
  }
})

type DateTimePickerMock = {
  __esModule: boolean
  default: jest.Mock
  DateTimePickerAndroid: { open: jest.Mock; __openMock: jest.Mock }
}

function getPickerMock(): DateTimePickerMock {
  return jest.requireMock('@react-native-community/datetimepicker') as DateTimePickerMock
}

const TEST_DATE = new Date('2024-06-15T10:30:00')

describe('DateField - iOS', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(Platform, 'OS', { get: () => 'ios', configurable: true })
  })

  it('renders the label', () => {
    render(<DateField label="Date" value={TEST_DATE} onChange={jest.fn()} />)

    expect(screen.getByText('Date')).toBeOnTheScreen()
  })

  it('does not render an error when error prop is absent', () => {
    render(<DateField label="Date" value={TEST_DATE} onChange={jest.fn()} />)

    expect(screen.queryByText(/error/i)).toBeNull()
  })

  it('renders the error message when error prop is set', () => {
    render(
      <DateField label="Date" value={TEST_DATE} onChange={jest.fn()} error="Date is required" />,
    )

    expect(screen.getByText('Date is required')).toBeOnTheScreen()
  })

  it('calls onChange when the native picker fires a new date', () => {
    const DateTimePicker = getPickerMock().default
    const onChange = jest.fn()

    render(<DateField label="Date" value={TEST_DATE} onChange={onChange} />)

    const newDate = new Date('2024-07-20T14:00:00')
    const [pickerProps] = DateTimePicker.mock.calls[0] as [
      { onChange: (e: object, d: Date | undefined) => void },
    ]
    pickerProps.onChange({}, newDate)

    expect(onChange).toHaveBeenCalledWith(newDate)
  })

  it('does not call onChange when the native picker fires undefined', () => {
    const DateTimePicker = getPickerMock().default
    const onChange = jest.fn()

    render(<DateField label="Date" value={TEST_DATE} onChange={onChange} />)

    const [pickerProps] = DateTimePicker.mock.calls[0] as [
      { onChange: (e: object, d: Date | undefined) => void },
    ]
    pickerProps.onChange({}, undefined)

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('DateField - Android', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true })
  })

  it('renders the label', () => {
    render(<DateField label="Departure" value={TEST_DATE} onChange={jest.fn()} />)

    expect(screen.getByText('Departure')).toBeOnTheScreen()
  })

  it('renders the formatted date value as text', () => {
    render(<DateField label="Departure" value={TEST_DATE} onChange={jest.fn()} />)

    expect(screen.getByText(TEST_DATE.toLocaleString())).toBeOnTheScreen()
  })

  it('renders the error message on Android when error prop is set', () => {
    render(
      <DateField label="Departure" value={TEST_DATE} onChange={jest.fn()} error="Required field" />,
    )

    expect(screen.getByText('Required field')).toBeOnTheScreen()
  })

  it('opens the Android date picker when the pressable is tapped', () => {
    const openMock = getPickerMock().DateTimePickerAndroid.open

    render(<DateField label="Departure" value={TEST_DATE} onChange={jest.fn()} />)

    fireEvent.press(screen.getByRole('button'))

    expect(openMock).toHaveBeenCalledTimes(1)
    expect(openMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: TEST_DATE, mode: 'date' }),
    )
  })

  it('opens the time picker after a date is picked in the date dialog', () => {
    const openMock = getPickerMock().DateTimePickerAndroid.open

    render(<DateField label="Departure" value={TEST_DATE} onChange={jest.fn()} />)

    fireEvent.press(screen.getByRole('button'))

    const { onChange: onDateChange } = openMock.mock.calls[0][0] as {
      onChange: (e: object, d: Date | undefined) => void
    }
    const pickedDate = new Date('2024-06-20T00:00:00')
    onDateChange({}, pickedDate)

    expect(openMock).toHaveBeenCalledTimes(2)
    expect(openMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: pickedDate, mode: 'time' }),
    )
  })

  it('calls onChange with the final datetime after both dialogs complete', () => {
    const openMock = getPickerMock().DateTimePickerAndroid.open
    const onChange = jest.fn()

    render(<DateField label="Departure" value={TEST_DATE} onChange={onChange} />)

    fireEvent.press(screen.getByRole('button'))

    const { onChange: onDateChange } = openMock.mock.calls[0][0] as {
      onChange: (e: object, d: Date | undefined) => void
    }
    const pickedDate = new Date('2024-06-20T00:00:00')
    onDateChange({}, pickedDate)

    const { onChange: onTimeChange } = openMock.mock.calls[1][0] as {
      onChange: (e: object, d: Date | undefined) => void
    }
    const pickedDateTime = new Date('2024-06-20T14:30:00')
    onTimeChange({}, pickedDateTime)

    expect(onChange).toHaveBeenCalledWith(pickedDateTime)
  })

  it('does not open the time picker when the date dialog is dismissed', () => {
    const openMock = getPickerMock().DateTimePickerAndroid.open

    render(<DateField label="Departure" value={TEST_DATE} onChange={jest.fn()} />)

    fireEvent.press(screen.getByRole('button'))

    const { onChange: onDateChange } = openMock.mock.calls[0][0] as {
      onChange: (e: object, d: Date | undefined) => void
    }
    onDateChange({}, undefined)

    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it('does not call onChange when the time dialog is dismissed', () => {
    const openMock = getPickerMock().DateTimePickerAndroid.open
    const onChange = jest.fn()

    render(<DateField label="Departure" value={TEST_DATE} onChange={onChange} />)

    fireEvent.press(screen.getByRole('button'))

    const { onChange: onDateChange } = openMock.mock.calls[0][0] as {
      onChange: (e: object, d: Date | undefined) => void
    }
    onDateChange({}, new Date('2024-06-20T00:00:00'))

    const { onChange: onTimeChange } = openMock.mock.calls[1][0] as {
      onChange: (e: object, d: Date | undefined) => void
    }
    onTimeChange({}, undefined)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders the day-only formatted value when mode is "date"', () => {
    render(<DateField label="Departure" value={TEST_DATE} onChange={jest.fn()} mode="date" />)

    expect(screen.getByText(TEST_DATE.toLocaleDateString())).toBeOnTheScreen()
  })

  it('calls onChange directly without a time dialog when mode is "date"', () => {
    const openMock = getPickerMock().DateTimePickerAndroid.open
    const onChange = jest.fn()

    render(<DateField label="Departure" value={TEST_DATE} onChange={onChange} mode="date" />)

    fireEvent.press(screen.getByRole('button'))

    const { onChange: onDateChange } = openMock.mock.calls[0][0] as {
      onChange: (e: object, d: Date | undefined) => void
    }
    const pickedDate = new Date('2024-06-20T00:00:00')
    onDateChange({}, pickedDate)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(pickedDate)
    // 'date' mode returns early - no second (time) dialog is opened.
    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it('forwards minimumDate to the Android date dialog', () => {
    const openMock = getPickerMock().DateTimePickerAndroid.open
    const minimumDate = new Date('2024-06-01T00:00:00')

    render(
      <DateField
        label="Departure"
        value={TEST_DATE}
        onChange={jest.fn()}
        minimumDate={minimumDate}
      />,
    )

    fireEvent.press(screen.getByRole('button'))

    expect(openMock).toHaveBeenCalledWith(expect.objectContaining({ minimumDate }))
  })
})
