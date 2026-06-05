import { fireEvent, render, screen } from '@testing-library/react-native'

import { TripDatesField } from './trip-dates-field'

// The nested DateField renders the native DateTimePicker on iOS (jest-expo's default
// Platform.OS). Mock it so DateField mounts and we can drive its onChange callbacks
// (first call = start field, second = end field) to exercise TripDatesField's handlers.
jest.mock('@react-native-community/datetimepicker', () => {
  const openMock = jest.fn()
  return {
    __esModule: true,
    default: jest.fn(() => null),
    DateTimePickerAndroid: { open: openMock, __openMock: openMock },
  }
})

type PickerMock = {
  __esModule: boolean
  default: jest.Mock
  DateTimePickerAndroid: { open: jest.Mock; __openMock: jest.Mock }
}

function getPickerMock(): PickerMock {
  return jest.requireMock('@react-native-community/datetimepicker') as PickerMock
}

type PickerProps = { value: Date; minimumDate?: Date; onChange: (e: object, d?: Date) => void }

function pickerCall(index: number): PickerProps {
  const DateTimePicker = getPickerMock().default
  return DateTimePicker.mock.calls[index][0] as PickerProps
}

describe('TripDatesField', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('disabled (no start date)', () => {
    it('renders the toggle label and an unchecked checkbox state', () => {
      render(<TripDatesField startDate={null} endDate={null} onChange={jest.fn()} />)

      expect(screen.getByText('Add travel dates')).toBeOnTheScreen()
      expect(screen.getByRole('checkbox')).toBeOnTheScreen()
      expect(screen.getByRole('checkbox', { checked: false })).toBeOnTheScreen()
    })

    it('does not render the date fields when disabled', () => {
      render(<TripDatesField startDate={null} endDate={null} onChange={jest.fn()} />)

      expect(screen.queryByText('Start date')).toBeNull()
      expect(screen.queryByText('End date')).toBeNull()
    })

    it('enables dates with today as start and end when the toggle is pressed', () => {
      const onChange = jest.fn()
      render(<TripDatesField startDate={null} endDate={null} onChange={onChange} />)

      fireEvent.press(screen.getByRole('checkbox'))

      expect(onChange).toHaveBeenCalledTimes(1)
      const [next] = onChange.mock.calls[0] as [{ startDate: string; endDate: string }]
      expect(next.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(next.endDate).toBe(next.startDate)
    })
  })

  describe('enabled (start date set)', () => {
    it('renders a checked checkbox and both date fields', () => {
      render(<TripDatesField startDate="2024-06-10" endDate="2024-06-20" onChange={jest.fn()} />)

      expect(screen.getByRole('checkbox', { checked: true })).toBeOnTheScreen()
      expect(screen.getByText('Start date')).toBeOnTheScreen()
      expect(screen.getByText('End date')).toBeOnTheScreen()
    })

    it('clears both dates when the toggle is pressed while enabled', () => {
      const onChange = jest.fn()
      render(<TripDatesField startDate="2024-06-10" endDate="2024-06-20" onChange={onChange} />)

      fireEvent.press(screen.getByRole('checkbox'))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith({ startDate: null, endDate: null })
    })

    it('passes the start date to the end field as its minimum selectable date', () => {
      render(<TripDatesField startDate="2024-06-10" endDate="2024-06-20" onChange={jest.fn()} />)

      // Second picker = end field; minimumDate is the start date as a local Date.
      expect(pickerCall(1).minimumDate).toEqual(new Date(2024, 5, 10))
    })

    it('keeps the end date when a new start is on or before it', () => {
      const onChange = jest.fn()
      render(<TripDatesField startDate="2024-06-10" endDate="2024-06-20" onChange={onChange} />)

      // Start field onChange with a new start still before the end: end is preserved.
      pickerCall(0).onChange({}, new Date(2024, 5, 12))

      expect(onChange).toHaveBeenCalledWith({ startDate: '2024-06-12', endDate: '2024-06-20' })
    })

    it('clamps the end date up to the new start when start moves past it', () => {
      const onChange = jest.fn()
      render(<TripDatesField startDate="2024-06-10" endDate="2024-06-20" onChange={onChange} />)

      // New start (06-25) is after the current end (06-20): end snaps to the new start.
      pickerCall(0).onChange({}, new Date(2024, 5, 25))

      expect(onChange).toHaveBeenCalledWith({ startDate: '2024-06-25', endDate: '2024-06-25' })
    })

    it('preserves a null end date when the start changes (no clamp branch)', () => {
      const onChange = jest.fn()
      render(<TripDatesField startDate="2024-06-10" endDate={null} onChange={onChange} />)

      pickerCall(0).onChange({}, new Date(2024, 5, 12))

      expect(onChange).toHaveBeenCalledWith({ startDate: '2024-06-12', endDate: null })
    })

    it('falls back to the start date for the end field value when end is null', () => {
      render(<TripDatesField startDate="2024-06-10" endDate={null} onChange={jest.fn()} />)

      // End field (second picker) shows the start date when no end is set.
      expect(pickerCall(1).value).toEqual(new Date(2024, 5, 10))
    })

    it('uses the end date for the end field value when it is set', () => {
      render(<TripDatesField startDate="2024-06-10" endDate="2024-06-20" onChange={jest.fn()} />)

      expect(pickerCall(1).value).toEqual(new Date(2024, 5, 20))
    })

    it('updates only the end date when the end field changes', () => {
      const onChange = jest.fn()
      render(<TripDatesField startDate="2024-06-10" endDate="2024-06-20" onChange={onChange} />)

      pickerCall(1).onChange({}, new Date(2024, 5, 22))

      expect(onChange).toHaveBeenCalledWith({ startDate: '2024-06-10', endDate: '2024-06-22' })
    })

    it('renders the error message under the end field when error is set', () => {
      render(
        <TripDatesField
          startDate="2024-06-10"
          endDate="2024-06-20"
          onChange={jest.fn()}
          error="End date must be after start"
        />,
      )

      expect(screen.getByText('End date must be after start')).toBeOnTheScreen()
    })

    it('does not render an error message when the error prop is absent', () => {
      render(<TripDatesField startDate="2024-06-10" endDate="2024-06-20" onChange={jest.fn()} />)

      expect(screen.queryByText(/must be after/i)).toBeNull()
    })
  })
})
