import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createExpense } from '@/features/expenses'
import type { TripMember } from '@/features/group'
import {
  addPackingItems,
  generatePackingSuggestions,
  type PackingCategory,
} from '@/features/packing'
import { recordSettlement } from '@/features/settlements'
import { isValidCategory, isValidSubcategory } from '@/features/taxonomy'
import { createEvent } from '@/features/timeline'
import type { Trip } from '@/features/trips'

import { amountToCents, resolveMemberId, resolveSplitMembers, splitEqually } from '../actions'
import type { CopilotAction } from '../schemas'

export type ExecuteActionVars = {
  action: CopilotAction
  members: TripMember[]
  myUserId: string
  trip: Trip
  language: 'en' | 'fr'
}

// Executes a copilot-proposed action AFTER the user confirms it, through the same APIs (and so
// the same RLS) the rest of the app uses. Invalidates the trip's queries so the change shows up.
export function useExecuteCopilotAction(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: ExecuteActionVars) => executeAction(tripId, vars),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips', tripId] })
      void queryClient.invalidateQueries({ queryKey: ['trips'], exact: true })
    },
  })
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

async function executeAction(tripId: string, vars: ExecuteActionVars): Promise<void> {
  const { action, members, myUserId, trip, language } = vars
  const args = action.args

  if (action.tool === 'add_expense') {
    const description = typeof args.description === 'string' ? args.description.trim() : ''
    const cents = amountToCents(args.amount)
    if (!description || cents === null) {
      throw new Error('Invalid expense')
    }
    const memberIds = resolveSplitMembers(args.splitWith, members, myUserId)
    if (memberIds.length === 0) {
      throw new Error('Invalid expense')
    }
    await createExpense({
      tripId,
      description,
      amountCents: cents,
      currency: trip.currency,
      baseAmountCents: cents,
      fxRate: 1,
      splits: splitEqually(cents, memberIds),
      category: null,
    })
    return
  }

  if (action.tool === 'add_event') {
    const title = typeof args.title === 'string' ? args.title.trim() : ''
    if (!title) {
      throw new Error('Invalid event')
    }
    const date = typeof args.date === 'string' && DATE_RE.test(args.date) ? args.date : null
    const time = typeof args.time === 'string' && TIME_RE.test(args.time) ? args.time : '12:00'
    const parsed = date ? new Date(`${date}T${time}:00`) : new Date()
    const startsAt = (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toISOString()
    const category =
      typeof args.category === 'string' && isValidCategory(args.category) ? args.category : 'other'
    const subcategory =
      typeof args.subcategory === 'string' &&
      isValidSubcategory(args.subcategory) &&
      args.subcategory.startsWith(`${category}.`)
        ? args.subcategory
        : null
    await createEvent({ tripId, title, category, subcategory, startsAt, notes: '' })
    return
  }

  if (action.tool === 'record_settlement') {
    const cents = amountToCents(args.amount)
    const fromId =
      typeof args.from === 'string' ? resolveMemberId(args.from, members, myUserId) : null
    const toId = typeof args.to === 'string' ? resolveMemberId(args.to, members, myUserId) : null
    if (cents === null || !fromId || !toId || fromId === toId) {
      throw new Error('Invalid settlement')
    }
    await recordSettlement({ tripId, fromMemberId: fromId, toMemberId: toId, amountCents: cents })
    return
  }

  if (action.tool !== 'add_packing') {
    // Exhaustiveness guard: a tool added to the schema but not handled above must never silently
    // fall through to the packing branch.
    throw new Error(`Unhandled action: ${action.tool}`)
  }

  const scope = args.scope === 'personal' ? 'personal' : 'shared'
  const request = typeof args.request === 'string' ? args.request : ''
  if (!trip.destination) {
    throw new Error('The trip needs a destination first')
  }
  const suggestions = await generatePackingSuggestions({
    destination: trip.destination,
    days: null,
    weather: '',
    language,
    hint: request,
    mode: 'generate',
    existing: [],
  })
  await addPackingItems(
    suggestions.map((s) => ({
      tripId,
      scope,
      ownerId: myUserId,
      label: s.label,
      category: s.category as PackingCategory,
      quantity: s.quantity,
    })),
  )
}
