import { useState } from 'react'

import { haptics } from './haptics'

// Pull-to-refresh over the queries behind a screen. Offline, a refetch pauses rather than fails and
// its promise waits for the network: the spinner follows `fetching`, not the promise, or it would
// spin until the connection came back.
export function usePullRefresh(refetchAll: () => Promise<unknown>, fetching: boolean) {
  const [pulled, setPulled] = useState(false)

  async function onRefresh() {
    haptics.light()
    setPulled(true)
    try {
      await refetchAll()
    } finally {
      setPulled(false)
    }
  }

  return { refreshing: pulled && fetching, onRefresh }
}
