// Thresholds for how much to trust the model's parse. Below LOW we nudge the user to review the
// fields before adding; at/above HIGH the parse is shown as reliable.
export const LOW_CONFIDENCE = 0.6
export const HIGH_CONFIDENCE = 0.85

export type ConfidenceLevel = 'low' | 'medium' | 'high'

// Bucket a 0-1 confidence score into a level that drives the meter colour and the review hint.
export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence < LOW_CONFIDENCE) {
    return 'low'
  }
  if (confidence < HIGH_CONFIDENCE) {
    return 'medium'
  }
  return 'high'
}
