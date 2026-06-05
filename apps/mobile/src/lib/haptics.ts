import * as Haptics from 'expo-haptics'

// Declarative haptic feedback wrappers. Centralised so call sites stay readable and feedback
// can be globally tuned/disabled later. Errors (e.g. unsupported device) are swallowed - a
// missing buzz must never break an interaction.
export const haptics = {
  // Light tap: selections, small toggles, card presses.
  light: () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  },
  // Medium tap: confirming a primary action (add, save).
  medium: () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  },
  // Selection tick: moving through segmented controls / pickers.
  selection: () => {
    void Haptics.selectionAsync().catch(() => {})
  },
  // Success notification: an action completed (expense added, trip created).
  success: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
  },
  // Warning notification: a destructive confirmation.
  warning: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
  },
  // Error notification: an action failed.
  error: () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
  },
}
