import * as Haptics from 'expo-haptics'

import { haptics } from './haptics'

const impact = Haptics.impactAsync as jest.Mock
const notify = Haptics.notificationAsync as jest.Mock
const selection = Haptics.selectionAsync as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('haptics', () => {
  it('light/medium fire an impact with the matching style', () => {
    haptics.light()
    expect(impact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)

    haptics.medium()
    expect(impact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
  })

  it('selection fires a selection tick', () => {
    haptics.selection()
    expect(selection).toHaveBeenCalledTimes(1)
  })

  it('success/warning/error fire the matching notification type', () => {
    haptics.success()
    expect(notify).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success)

    haptics.warning()
    expect(notify).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning)

    haptics.error()
    expect(notify).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error)
  })

  it('swallows a rejected feedback call (unsupported device) without throwing', () => {
    impact.mockRejectedValueOnce(new Error('unsupported'))
    expect(() => haptics.light()).not.toThrow()
  })
})
