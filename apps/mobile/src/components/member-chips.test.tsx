import { fireEvent, render, screen } from '@testing-library/react-native'

import { MemberChips } from './member-chips'

const members = [
  { userId: 'u1', displayName: 'Zoe Tran', avatarUrl: null },
  { userId: 'u2', displayName: 'Marc-Antoine Dupont', avatarUrl: null },
]

function chip(name: string) {
  return screen.getByRole('checkbox', { name })
}

describe('MemberChips', () => {
  it('renders the label', () => {
    render(<MemberChips members={members} selected={[]} onChange={() => {}} label="Who" />)

    expect(screen.getByText('Who')).toBeOnTheScreen()
  })

  it('renders nothing when there are no members', () => {
    const { toJSON } = render(
      <MemberChips members={[]} selected={[]} onChange={() => {}} label="Who" />,
    )

    expect(toJSON()).toBeNull()
  })

  it('selects every chip when selected is [] (everyone)', () => {
    render(<MemberChips members={members} selected={[]} onChange={() => {}} label="Who" />)

    expect(chip('Zoe Tran').props.accessibilityState).toEqual({ checked: true })
    expect(chip('Marc-Antoine Dupont').props.accessibilityState).toEqual({ checked: true })
  })

  it('toggling a member off from the everyone state sends the remaining member ids', () => {
    const onChange = jest.fn()
    render(<MemberChips members={members} selected={[]} onChange={onChange} label="Who" />)

    fireEvent.press(chip('Zoe Tran'))

    expect(onChange).toHaveBeenCalledWith(['u2'])
  })

  it('collapses back to [] when the toggled subset ends up covering every member', () => {
    const onChange = jest.fn()
    render(<MemberChips members={members} selected={['u1']} onChange={onChange} label="Who" />)

    // u1 is already selected; checking u2 too now covers every member.
    fireEvent.press(chip('Marc-Antoine Dupont'))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('deselecting the last selected member flips the selector back to everyone ([])', () => {
    const onChange = jest.fn()
    render(<MemberChips members={members} selected={['u1']} onChange={onChange} label="Who" />)

    expect(chip('Zoe Tran').props.accessibilityState).toEqual({ checked: true })
    expect(chip('Marc-Antoine Dupont').props.accessibilityState).toEqual({ checked: false })

    fireEvent.press(chip('Zoe Tran'))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('falls back to the generic member label when displayName is null', () => {
    const anon = [{ userId: 'u9', displayName: null, avatarUrl: null }]
    render(<MemberChips members={anon} selected={[]} onChange={() => {}} label="Who" />)

    expect(chip('Member')).toBeOnTheScreen()
  })
})
