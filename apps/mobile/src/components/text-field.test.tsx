import { fireEvent, render, screen } from '@testing-library/react-native'

import { TextField } from './text-field'

describe('TextField', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the label', () => {
    render(<TextField label="Email" />)

    expect(screen.getByText('Email')).toBeOnTheScreen()
  })

  it('renders the placeholder text', () => {
    render(<TextField label="Email" placeholder="Enter your email" />)

    expect(screen.getByPlaceholderText('Enter your email')).toBeOnTheScreen()
  })

  it('displays the current value', () => {
    render(<TextField label="Email" value="hello@example.com" onChangeText={jest.fn()} />)

    expect(screen.getByDisplayValue('hello@example.com')).toBeOnTheScreen()
  })

  it('calls onChangeText when the user types', () => {
    const onChangeText = jest.fn()
    render(<TextField label="Name" onChangeText={onChangeText} />)

    fireEvent.changeText(screen.getByRole('text'), 'Alice')

    expect(onChangeText).toHaveBeenCalledWith('Alice')
  })

  it('does not render an error message when error is not set', () => {
    render(<TextField label="Name" />)

    expect(screen.queryByText(/error/i)).toBeNull()
  })

  it('renders the error message when error prop is provided', () => {
    render(<TextField label="Name" error="This field is required" />)

    expect(screen.getByText('This field is required')).toBeOnTheScreen()
  })

  it('does not render an error message when error is undefined', () => {
    render(<TextField label="Name" error={undefined} />)

    expect(screen.queryByRole('text', { name: /error/i })).toBeNull()
  })

  it('forwards additional TextInput props', () => {
    render(
      <TextField
        label="Password"
        placeholder="Enter password"
        secureTextEntry={true}
        testID="password-input"
      />,
    )

    expect(screen.getByPlaceholderText('Enter password')).toBeOnTheScreen()
  })
})
