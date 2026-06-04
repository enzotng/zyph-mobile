import { useMutation } from '@tanstack/react-query'

import { parseEmailViaAi } from '../api/smart-import.api'

export function useParseEmail() {
  return useMutation({ mutationFn: parseEmailViaAi })
}
