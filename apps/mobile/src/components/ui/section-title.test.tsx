import { fireEvent, render, screen } from '@testing-library/react-native'
import { SectionTitle } from './section-title'

describe('SectionTitle', () => {
  it('renders the title text', () => {
    render(<SectionTitle>My Section</SectionTitle>)
    expect(screen.getByText('My Section')).toBeOnTheScreen()
  })

  it('does not render action when action prop is not provided', () => {
    render(<SectionTitle>My Section</SectionTitle>)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders the action text when action prop is provided', () => {
    render(
      <SectionTitle action="See all" onAction={() => {}}>
        My Section
      </SectionTitle>,
    )
    expect(screen.getByText('See all')).toBeOnTheScreen()
  })

  it('calls onAction when the action is pressed', () => {
    const onAction = jest.fn()
    render(
      <SectionTitle action="See all" onAction={onAction}>
        My Section
      </SectionTitle>,
    )
    fireEvent.press(screen.getByRole('button'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('renders without throwing when action is set but onAction is undefined', () => {
    expect(() => render(<SectionTitle action="See all">My Section</SectionTitle>)).not.toThrow()
  })
})
