import { fireEvent, render, screen } from '@testing-library/react-native'

import type { Block } from '../schemas'
import { type ActionState, CopilotBlocks } from './copilot-blocks'

// Stub CopilotWidget so the widget branch never needs query providers.
jest.mock('./copilot-widget', () => ({
  CopilotWidget: () => null,
}))

const TRIP_ID = 'trip-1'
const MESSAGE_ID = 'm1'

const defaultProps = {
  tripId: TRIP_ID,
  messageId: MESSAGE_ID,
  actionStateFor: (_index: number): ActionState => 'pending',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
  onChip: jest.fn(),
  executePending: false,
}

describe('CopilotBlocks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders a text block with its text', () => {
    const blocks: Block[] = [{ kind: 'text', text: 'Hello from Zo' }]

    render(<CopilotBlocks {...defaultProps} blocks={blocks} />)

    expect(screen.getByText('Hello from Zo')).toBeTruthy()
  })

  it('renders an action block (pending) with a confirm card, and pressing Confirm calls onConfirm(0, block)', () => {
    const actionBlock: Extract<Block, { kind: 'action' }> = {
      kind: 'action',
      tool: 'add_expense',
      args: { amount: 42 },
      text: 'I will add an expense of 42',
    }
    const blocks: Block[] = [actionBlock]
    const onConfirm = jest.fn()

    render(
      <CopilotBlocks
        {...defaultProps}
        blocks={blocks}
        onConfirm={onConfirm}
        actionStateFor={() => 'pending'}
      />,
    )

    // The action text is shown.
    expect(screen.getByText('I will add an expense of 42')).toBeTruthy()

    // The confirm button is rendered.
    const confirmButton = screen.getByText('Confirm')
    expect(confirmButton).toBeTruthy()

    // Pressing Confirm calls onConfirm with the block index and the block.
    fireEvent.press(confirmButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith(0, actionBlock)
  })

  it('renders chips and fires onChip on press', () => {
    const onChip = jest.fn()
    const chip = { action: 'navigate', to: 'spend', label: 'Open Spend' } as const
    render(
      <CopilotBlocks
        blocks={[{ kind: 'chips', chips: [chip] }]}
        tripId="t1"
        messageId="m1"
        actionStateFor={() => 'pending'}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
        onChip={onChip}
        executePending={false}
      />,
    )
    fireEvent.press(screen.getByText('Open Spend'))
    expect(onChip).toHaveBeenCalledWith(chip)
  })
})
