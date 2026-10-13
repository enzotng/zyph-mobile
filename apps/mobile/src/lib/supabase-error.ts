type ErrorFields = { message: string; code?: string; details?: string; hint?: string }

export class SupabaseRequestError extends Error {
  readonly code?: string
  readonly details?: string
  readonly hint?: string

  constructor({ message, code, details, hint }: ErrorFields) {
    super(message)
    this.name = 'SupabaseRequestError'
    this.code = code
    this.details = details
    this.hint = hint
  }
}

function hasMessage(value: unknown): value is ErrorFields {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string'
  )
}

// PostgREST returns its errors as plain objects, not Error instances, so a caller testing
// `instanceof Error` loses the message a function raised. API wrappers rethrow through this.
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }
  if (hasMessage(error)) {
    return new SupabaseRequestError(error)
  }
  return new Error(String(error))
}

// What a screen shows for a failure. Database errors are never shown as such: their text is English
// function wording, constraint and policy names, or a network TypeError. Screens that react to a
// known refusal match error.message themselves; this is only for display.
export function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof SupabaseRequestError) {
    return fallback
  }
  return error instanceof Error && error.message ? error.message : fallback
}
