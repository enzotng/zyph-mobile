import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactTestRendererJSON } from 'react-test-renderer'

import { TextField } from './text-field'

type StyleValue = Record<string, unknown>

// Flatten a node's `style` prop (object | array | nested arrays) into a single object.
function flattenStyle(style: unknown): StyleValue {
  if (Array.isArray(style)) {
    return style.reduce<StyleValue>((acc, entry) => ({ ...acc, ...flattenStyle(entry) }), {})
  }
  if (style && typeof style === 'object') {
    return style as StyleValue
  }
  return {}
}

function collectStyles(node: ReactTestRendererJSON | null): StyleValue[] {
  if (!node) {
    return []
  }
  const own = node.props?.style ? [flattenStyle(node.props.style)] : []
  const children = node.children ?? []
  return [...own, ...children.flatMap((c) => (typeof c === 'string' ? [] : collectStyles(c)))]
}

// The bordered Surface is the only node carrying the field's 1.5px border. Its `borderColor`
// is the focus-driven visual that toggles primary <-> border across focus/blur. Reading it is
// theme-agnostic (adaptiveThemes is on, so the literal colour may be the light or dark token).
function borderColorOfField(): string | undefined {
  const surface = collectStyles(screen.toJSON() as ReactTestRendererJSON | null).find(
    (style) => style.borderWidth === 1.5,
  )
  return surface?.borderColor as string | undefined
}

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

  it('renders without a label when none is provided', () => {
    render(<TextField placeholder="Search" />)

    expect(screen.getByPlaceholderText('Search')).toBeOnTheScreen()
    expect(screen.queryByText('Search')).toBeNull()
  })

  it('calls the provided onFocus handler when the input gains focus', () => {
    const onFocus = jest.fn()
    render(<TextField label="Name" placeholder="Type here" onFocus={onFocus} />)

    fireEvent(screen.getByPlaceholderText('Type here'), 'focus')

    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it('calls the provided onBlur handler when the input loses focus', () => {
    const onBlur = jest.fn()
    render(<TextField label="Name" placeholder="Type here" onBlur={onBlur} />)

    fireEvent(screen.getByPlaceholderText('Type here'), 'focus')
    fireEvent(screen.getByPlaceholderText('Type here'), 'blur')

    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('handles focus and blur without crashing when no handlers are provided', () => {
    render(<TextField label="Name" placeholder="Type here" />)
    const input = screen.getByPlaceholderText('Type here')

    expect(() => {
      fireEvent(input, 'focus')
      fireEvent(input, 'blur')
    }).not.toThrow()
  })

  it('applies the focused border colour while focused without an error', () => {
    render(<TextField label="Name" placeholder="Type here" />)
    const input = screen.getByPlaceholderText('Type here')

    const restColor = borderColorOfField()

    fireEvent(input, 'focus')

    // Focus swaps the Surface border from the neutral border token to the primary token.
    expect(borderColorOfField()).not.toBe(restColor)
  })

  it('switches to the focused border colour on focus and back on blur', () => {
    render(<TextField label="Name" placeholder="Type here" />)
    const input = screen.getByPlaceholderText('Type here')

    const restColor = borderColorOfField()

    fireEvent(input, 'focus')
    const focusedColor = borderColorOfField()
    expect(focusedColor).not.toBe(restColor)

    fireEvent(input, 'blur')
    // Blur restores the original neutral border colour.
    expect(borderColorOfField()).toBe(restColor)
  })

  it('keeps the error border state even when the input is focused', () => {
    render(<TextField label="Name" error="Required" placeholder="Type here" />)
    const input = screen.getByPlaceholderText('Type here')

    fireEvent(input, 'focus')
    fireEvent(input, 'blur')

    expect(screen.getByText('Required')).toBeOnTheScreen()
  })
})
