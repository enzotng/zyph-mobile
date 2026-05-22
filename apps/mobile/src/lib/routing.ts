// Expo Router params can be a string or string[] (repeated/array route params).
// Normalize to a single string, defaulting to '' when absent.
export function paramString(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ''
}
