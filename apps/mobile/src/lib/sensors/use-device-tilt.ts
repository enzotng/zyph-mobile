import { DeviceMotion } from 'expo-sensors'
import { useEffect, useState } from 'react'

export type DeviceTiltState = {
  pitch: number
  roll: number
  available: boolean
}

const INITIAL: DeviceTiltState = { pitch: 0, roll: 0, available: false }

// Low-pass smoothing for tilt to dampen jitter while keeping responsiveness.
function smooth(prev: number, next: number, alpha = 0.25): number {
  return prev + alpha * (next - prev)
}

export function useDeviceTilt(enabled: boolean): DeviceTiltState {
  const [state, setState] = useState<DeviceTiltState>(INITIAL)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    let sub: ReturnType<typeof DeviceMotion.addListener> | null = null

    async function start() {
      const available = await DeviceMotion.isAvailableAsync()
      if (cancelled || !available) {
        return
      }
      DeviceMotion.setUpdateInterval(50)
      sub = DeviceMotion.addListener((event) => {
        const rotation = event.rotation
        if (!rotation) {
          return
        }
        setState((prev) => ({
          pitch: smooth(prev.pitch, rotation.beta ?? 0),
          roll: smooth(prev.roll, rotation.gamma ?? 0),
          available: true,
        }))
      })
    }

    void start()

    return () => {
      cancelled = true
      sub?.remove()
    }
  }, [enabled])

  return enabled ? state : INITIAL
}
