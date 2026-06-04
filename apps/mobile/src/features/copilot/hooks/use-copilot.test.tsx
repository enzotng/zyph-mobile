import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/copilot.api'
import { useAskCopilot } from './use-copilot'

jest.mock('@/lib/supabase')
jest.mock('../api/copilot.api')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useAskCopilot', () => {
  it('resolves with the copilot answer', async () => {
    jest.mocked(api.askCopilot).mockResolvedValue({ answer: 'Next up: your flight to Rome.' })
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useAskCopilot(), { wrapper })
    result.current.mutate({
      context: 'Trip: Rome',
      language: 'en',
      messages: [{ role: 'user', content: 'what is next?' }],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ answer: 'Next up: your flight to Rome.' })
    // TanStack Query v5 passes a second mutate-context arg to the mutationFn.
    expect(api.askCopilot).toHaveBeenCalledWith(
      {
        context: 'Trip: Rome',
        language: 'en',
        messages: [{ role: 'user', content: 'what is next?' }],
      },
      expect.anything(),
    )
  })
})
