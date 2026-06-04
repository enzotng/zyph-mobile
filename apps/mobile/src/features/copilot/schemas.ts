import { z } from 'zod'

// Boundary contract for the copilot edge function's response. The function returns free
// prose, so we enforce a non-empty answer string before it reaches the UI.
export const copilotAnswerSchema = z.object({
  answer: z.string().min(1),
})

export type CopilotAnswer = z.infer<typeof copilotAnswerSchema>
