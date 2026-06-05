import { fireEvent, render, screen } from '@testing-library/react-native'

import { GateLocationField, type GateLocationValue } from './gate-location-field'

// The runtime guards (`value?.lat ?? 0`, `value?.label ?? ''`) defend against partial
// values that the static type forbids. Build such a value through a typed helper so the
// fallback branches are exercised without `any`.
function partialValue(partial: Partial<NonNullable<GateLocationValue>>): GateLocationValue {
  return partial as GateLocationValue
}

// Isolate GateLocationField from its children: both have (or warrant) their own tests
// and pull in native modules (expo-maps, expo-location, place search). Lightweight stubs
// expose the props we need to assert on and to drive onChange/onChangeText branches.
type LocationPickerProps = {
  label?: string
  value: { lat: number; lng: number } | null
  onChange: (coords: { lat: number; lng: number }) => void
}

jest.mock('@/components/location-picker', () => {
  const { Pressable: RNPressable, Text: RNText, View } = require('react-native')
  return {
    LocationPicker: ({ label, value, onChange }: LocationPickerProps) => (
      <View testID="location-picker">
        {label ? <RNText>{label}</RNText> : null}
        <RNText testID="location-picker-value">
          {value ? `${value.lat},${value.lng}` : 'null'}
        </RNText>
        <RNPressable
          testID="location-picker-change"
          onPress={() => onChange({ lat: 48.8, lng: 2.3 })}
        />
      </View>
    ),
  }
})

type TextFieldStubProps = {
  label?: string
  placeholder?: string
  value?: string
  onChangeText?: (text: string) => void
}

jest.mock('@/components/text-field', () => {
  const { Text: RNText, TextInput: RNTextInput, View } = require('react-native')
  return {
    TextField: ({ label, placeholder, value, onChangeText }: TextFieldStubProps) => (
      <View>
        {label ? <RNText>{label}</RNText> : null}
        <RNTextInput
          testID="gate-label-input"
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    ),
  }
})

describe('GateLocationField', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the toggle label and stays collapsed when value is null', () => {
    render(<GateLocationField value={null} onChange={jest.fn()} />)

    expect(screen.getByText('Add a precise gate / destination')).toBeOnTheScreen()
    // Collapsed: neither child of the expanded body is rendered.
    expect(screen.queryByPlaceholderText('Gate 24B, Terminal 2C…')).toBeNull()
    expect(screen.queryByTestId('location-picker')).toBeNull()
  })

  it('marks the toggle unchecked when collapsed', () => {
    render(<GateLocationField value={null} onChange={jest.fn()} />)

    const toggle = screen.getByRole('checkbox')
    expect(toggle.props.accessibilityState).toEqual({ checked: false })
  })

  it('expands and renders both fields when value is non-null', () => {
    render(<GateLocationField value={{ label: 'Gate 3', lat: 0, lng: 0 }} onChange={jest.fn()} />)

    expect(screen.getByText('Gate label')).toBeOnTheScreen()
    expect(screen.getByPlaceholderText('Gate 24B, Terminal 2C…')).toBeOnTheScreen()
    expect(screen.getByText('Gate location')).toBeOnTheScreen()
    expect(screen.getByTestId('location-picker')).toBeOnTheScreen()
  })

  it('marks the toggle checked when expanded', () => {
    render(<GateLocationField value={{ label: '', lat: 0, lng: 0 }} onChange={jest.fn()} />)

    const toggle = screen.getByRole('checkbox')
    expect(toggle.props.accessibilityState).toEqual({ checked: true })
  })

  it('expands with a fresh empty value when toggled from collapsed', () => {
    const onChange = jest.fn()
    render(<GateLocationField value={null} onChange={onChange} />)

    fireEvent.press(screen.getByRole('checkbox'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ label: '', lat: 0, lng: 0 })
  })

  it('collapses (clears value) when toggled from expanded', () => {
    const onChange = jest.fn()
    render(<GateLocationField value={{ label: 'Gate 3', lat: 1, lng: 2 }} onChange={onChange} />)

    fireEvent.press(screen.getByRole('checkbox'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows the current label in the text field', () => {
    render(<GateLocationField value={{ label: 'Gate 3', lat: 1, lng: 2 }} onChange={jest.fn()} />)

    expect(screen.getByDisplayValue('Gate 3')).toBeOnTheScreen()
  })

  it('falls back to an empty string when the label is missing', () => {
    // value present but label is empty: the `value?.label ?? ''` fallback path.
    render(<GateLocationField value={{ label: '', lat: 1, lng: 2 }} onChange={jest.fn()} />)

    expect(screen.getByTestId('gate-label-input').props.value).toBe('')
  })

  it('preserves existing coords when the label changes', () => {
    const onChange = jest.fn()
    render(<GateLocationField value={{ label: 'old', lat: 12, lng: 34 }} onChange={onChange} />)

    fireEvent.changeText(screen.getByTestId('gate-label-input'), 'Terminal 2')

    expect(onChange).toHaveBeenCalledWith({ label: 'Terminal 2', lat: 12, lng: 34 })
  })

  it('preserves the label when coords change', () => {
    const onChange = jest.fn()
    render(<GateLocationField value={{ label: 'Gate 3', lat: 0, lng: 0 }} onChange={onChange} />)

    fireEvent.press(screen.getByTestId('location-picker-change'))

    expect(onChange).toHaveBeenCalledWith({ label: 'Gate 3', lat: 48.8, lng: 2.3 })
  })

  it('passes null to the location picker when coords are still 0/0', () => {
    render(<GateLocationField value={{ label: 'Gate 3', lat: 0, lng: 0 }} onChange={jest.fn()} />)

    expect(screen.getByTestId('location-picker-value')).toHaveTextContent('null')
  })

  it('passes the coords to the location picker when latitude is set', () => {
    // Exercises the left side of the `lat !== 0 || lng !== 0` OR.
    render(<GateLocationField value={{ label: 'Gate 3', lat: 5, lng: 0 }} onChange={jest.fn()} />)

    expect(screen.getByTestId('location-picker-value')).toHaveTextContent('5,0')
  })

  it('passes the coords to the location picker when longitude is set', () => {
    // Exercises the right side of the `lat !== 0 || lng !== 0` OR.
    render(<GateLocationField value={{ label: 'Gate 3', lat: 0, lng: 7 }} onChange={jest.fn()} />)

    expect(screen.getByTestId('location-picker-value')).toHaveTextContent('0,7')
  })

  it('renders an empty input when the value has no label field', () => {
    // Hits the `value?.label ?? ''` render fallback when label is absent.
    render(<GateLocationField value={partialValue({ lat: 1, lng: 2 })} onChange={jest.fn()} />)

    expect(screen.getByTestId('gate-label-input').props.value).toBe('')
  })

  it('defaults missing coords to zero when the label changes', () => {
    // Hits the `value?.lat ?? 0` / `value?.lng ?? 0` fallbacks in updateLabel.
    const onChange = jest.fn()
    render(<GateLocationField value={partialValue({ label: 'old' })} onChange={onChange} />)

    fireEvent.changeText(screen.getByTestId('gate-label-input'), 'Terminal 2')

    expect(onChange).toHaveBeenCalledWith({ label: 'Terminal 2', lat: 0, lng: 0 })
  })

  it('defaults a missing label to empty when coords change', () => {
    // Hits the `value?.label ?? ''` fallback in updateCoords.
    const onChange = jest.fn()
    render(<GateLocationField value={partialValue({ lat: 1, lng: 2 })} onChange={onChange} />)

    fireEvent.press(screen.getByTestId('location-picker-change'))

    expect(onChange).toHaveBeenCalledWith({ label: '', lat: 48.8, lng: 2.3 })
  })
})
