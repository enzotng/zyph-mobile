import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { BottomSheet } from './bottom-sheet'

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
    expect(() =>
      render(
        <BottomSheet open onClose={() => undefined}>
          <Text>No title</Text>
        </BottomSheet>,
      ),
    ).not.toThrow()
  })
})
