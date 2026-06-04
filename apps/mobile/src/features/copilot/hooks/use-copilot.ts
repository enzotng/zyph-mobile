import { useMutation } from '@tanstack/react-query'

import { askCopilot } from '../api/copilot.api'

export function useAskCopilot() {
  return useMutation({ mutationFn: askCopilot })
}
