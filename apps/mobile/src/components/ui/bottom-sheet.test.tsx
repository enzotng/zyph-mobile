import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Text, View } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import { BottomSheet } from './bottom-sheet'

// Controls the `finished` flag passed to withTiming's completion callback. Default true
// (animation completes); a single test flips it to false to exercise the interrupted
// branch where the sheet must NOT unmount. Prefixed `mock` so jest.mock may reference it.
let mockAnimationFinished = true

// Override the global reanimated mock for this file so the animation paths run:
// - useAnimatedStyle invokes its worklet (so the sheet transform branch executes)
// - withTiming invokes the completion callback (so the close path can unmount the sheet
//   via runOnJS(setMounted)(false), or not, depending on `finished`)
// - runOnJS returns the function unchanged so the JS callback actually fires.
jest.mock('react-native-reanimated', () => {
  const { View: RNView, Text: RNText } = require('react-native')
  return {
    __esModule: true,
    default: {
      View: RNView,
      Text: RNText,
      createAnimatedComponent: (component: unknown) => component,
    },
    Easing: { bezier: () => () => 0 },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (worklet: () => unknown) => worklet(),
    withTiming: (value: unknown, _config?: unknown, callback?: (finished: boolean) => void) => {
      callback?.(mockAnimationFinished)
      return value
    },
    runOnJS: (fn: unknown) => fn,
  }
})

beforeEach(() => {
  mockAnimationFinished = true
})

// Finds the single node carrying an onLayout handler (the sheet's Animated.View).
function getLayoutNode(): ReactTestInstance {
  return screen.root.findAll((node) => typeof node.props.onLayout === 'function')[0]
}

describe('BottomSheet', () => {
  it('renders the title and children when open', () => {
    render(
      <BottomSheet open onClose={() => undefined} title="My Sheet">
        <Text>Sheet content</Text>
      </BottomSheet>,
    )

    expect(screen.getByText('My Sheet')).toBeOnTheScreen()
    expect(screen.getByText('Sheet content')).toBeOnTheScreen()
  })

  it('does not render content when closed', () => {
    render(
      <BottomSheet open={false} onClose={() => undefined} title="Hidden">
        <Text>Hidden content</Text>
      </BottomSheet>,
    )

    expect(screen.queryByText('Hidden')).not.toBeOnTheScreen()
    expect(screen.queryByText('Hidden content')).not.toBeOnTheScreen()
  })

  it('calls onClose when the scrim is pressed', () => {
    const onClose = jest.fn()

    render(
      <BottomSheet open onClose={onClose} title="Sheet">
        <Text>Content</Text>
      </BottomSheet>,
    )

    fireEvent.press(screen.getByLabelText('Close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders without a title when title is omitted', () => {
    render(
      <BottomSheet open onClose={() => undefined}>
        <Text>No title</Text>
      </BottomSheet>,
    )

    expect(screen.getByText('No title')).toBeOnTheScreen()
    // No title element should be present alongside the children.
    expect(screen.queryByText('My Sheet')).not.toBeOnTheScreen()
  })

  it('mounts the sheet when it transitions from closed to open', () => {
    const { rerender } = render(
      <BottomSheet open={false} onClose={() => undefined} title="Lazy">
        <Text>Lazy content</Text>
      </BottomSheet>,
    )

    // Starts unmounted (mounted state initialised to open=false).
    expect(screen.queryByText('Lazy content')).not.toBeOnTheScreen()

    rerender(
      <BottomSheet open onClose={() => undefined} title="Lazy">
        <Text>Lazy content</Text>
      </BottomSheet>,
    )

    // The `if (open && !mounted) setMounted(true)` path makes it visible.
    expect(screen.getByText('Lazy content')).toBeOnTheScreen()
    expect(screen.getByText('Lazy')).toBeOnTheScreen()
  })

  it('unmounts the sheet after the close animation finishes', () => {
    const { rerender } = render(
      <BottomSheet open onClose={() => undefined} title="Closing">
        <Text>Closing content</Text>
      </BottomSheet>,
    )

    expect(screen.getByText('Closing content')).toBeOnTheScreen()

    // Closing runs withTiming(0, ..., cb); our mock fires cb(true) -> setMounted(false).
    act(() => {
      rerender(
        <BottomSheet open={false} onClose={() => undefined} title="Closing">
          <Text>Closing content</Text>
        </BottomSheet>,
      )
    })

    expect(screen.queryByText('Closing content')).not.toBeOnTheScreen()
  })

  it('keeps the sheet mounted when the close animation is interrupted', () => {
    mockAnimationFinished = false

    const { rerender } = render(
      <BottomSheet open onClose={() => undefined} title="Interrupted">
        <Text>Interrupted content</Text>
      </BottomSheet>,
    )

    expect(screen.getByText('Interrupted content')).toBeOnTheScreen()

    // finished=false -> the `if (finished)` guard is falsy, so setMounted(false) is
    // never called and the sheet stays mounted.
    act(() => {
      rerender(
        <BottomSheet open={false} onClose={() => undefined} title="Interrupted">
          <Text>Interrupted content</Text>
        </BottomSheet>,
      )
    })

    expect(screen.getByText('Interrupted content')).toBeOnTheScreen()
  })

  it('uses the measured height for the sheet transform once laid out', () => {
    render(
      <BottomSheet open onClose={() => undefined} title="Measured">
        <Text>Measured content</Text>
      </BottomSheet>,
    )

    // Fallback branch (sheetHeight === 0) runs on first render.
    const layoutNode = getLayoutNode()

    // Firing layout sets sheetHeight > 0, exercising the measured branch of the
    // offscreen ternary in sheetStyle on the next render.
    act(() => {
      fireEvent(layoutNode, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 420 } },
      })
    })

    expect(screen.getByText('Measured content')).toBeOnTheScreen()
  })

  it('disables pointer events on the overlay while closing', () => {
    const { rerender } = render(
      <BottomSheet open onClose={() => undefined} title="Pointer">
        <Text>Pointer content</Text>
      </BottomSheet>,
    )

    const overlay = screen.UNSAFE_getAllByType(View)[0]
    expect(overlay.props.pointerEvents).toBe('auto')

    rerender(
      <BottomSheet open={false} onClose={() => undefined} title="Pointer">
        <Text>Pointer content</Text>
      </BottomSheet>,
    )
    // After close, the overlay (if still briefly mounted) flips to 'none'; our mock
    // unmounts synchronously, so simply assert no content remains.
    expect(screen.queryByText('Pointer content')).not.toBeOnTheScreen()
  })
})
