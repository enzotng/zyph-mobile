const WALKING_SPEED_M_PER_S = 5_000 / 3_600

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '-'
  if (meters < 10) return `${Math.round(meters)} m`
  if (meters < 1_000) return `${Math.round(meters / 5) * 5} m`
  if (meters < 10_000) return `${(meters / 1_000).toFixed(1)} km`
  return `${Math.round(meters / 1_000)} km`
}

export function formatWalkingTime(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '-'
  const seconds = meters / WALKING_SPEED_M_PER_S
  if (seconds < 60) return '<1 min'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return `${hours} h`
  return `${hours} h ${rest}`
}
