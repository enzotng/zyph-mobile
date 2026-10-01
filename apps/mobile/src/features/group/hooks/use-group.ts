import type { QueryClient } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addGhostMember,
  claimTripSlot,
  detachTripMember,
  getTripClaimOptions,
  leaveTrip,
  listTripMemberNames,
  listTripMembers,
  regenerateInviteCode,
  removeTripMember,
  renameGhostMember,
} from '../api/group.api'

export function tripMembersQueryKey(tripId: string) {
  return ['trips', tripId, 'members'] as const
}

export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: tripMembersQueryKey(tripId),
    queryFn: () => listTripMembers(tripId),
    enabled: Boolean(tripId),
  })
}

export function tripMemberNamesQueryKey(tripId: string) {
  return ['trips', tripId, 'member-names'] as const
}

// Names for ALL members incl. removed - for resolving historical splits/balances. The selectable
// member lists keep using useTripMembers (active only).
export function useTripMemberNames(tripId: string) {
  return useQuery({
    queryKey: tripMemberNamesQueryKey(tripId),
    queryFn: () => listTripMemberNames(tripId),
    enabled: Boolean(tripId),
  })
}

export function useRegenerateInviteCode(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => regenerateInviteCode(tripId),
    onSuccess: () => {
      // Refresh the cached trip so the new invite code is reflected immediately.
      void queryClient.invalidateQueries({ queryKey: ['trips', tripId], exact: true })
    },
  })
}

export function useLeaveTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: leaveTrip,
    onSuccess: () => {
      // The trip is gone from the user's list and balances need a refresh anyway.
      void queryClient.invalidateQueries({ queryKey: ['trips'] })
    },
  })
}

export function useRemoveTripMember(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removeTripMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tripMembersQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] })
    },
  })
}

export function tripClaimOptionsQueryKey(code: string) {
  return ['trip-claim-options', code] as const
}

export function useClaimOptions(code: string) {
  return useQuery({
    queryKey: tripClaimOptionsQueryKey(code),
    queryFn: () => getTripClaimOptions(code),
    enabled: Boolean(code),
    // An invalid code and a rate-limit refusal are final answers, not transient failures: the
    // default retry would spend three of the caller's 30 hourly attempts on every typo.
    retry: false,
    // Never answer from a previous visit. myStatus decides whether named places may be offered,
    // and claim_trip_slot reactivates an existing row without ever reading the slot id - so a
    // stale 'not a member' would let a dormant member tap a name and silently rebind their old
    // place instead.
    gcTime: 0,
  })
}

export function useClaimSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, slotId }: { code: string; slotId: string | null }) =>
      claimTripSlot(code, slotId),
    onSuccess: (_tripId, { code }) => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] })
      // Drop rather than invalidate: nothing else reads this key, and re-entering the same code
      // within staleTime would otherwise serve the pre-claim list, offering a slot that now
      // answers 'already a member'.
      queryClient.removeQueries({ queryKey: tripClaimOptionsQueryKey(code) })
    },
  })
}

// Adding, renaming and detaching all rewrite the place list: the member list, the balances (a place
// is a balance line whether or not an account holds it) and the historical name lookup.
function invalidateMemberQueries(queryClient: QueryClient, tripId: string) {
  void queryClient.invalidateQueries({ queryKey: tripMembersQueryKey(tripId) })
  void queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] })
  void queryClient.invalidateQueries({ queryKey: tripMemberNamesQueryKey(tripId) })
  // The trips list embeds its members, and Home stays mounted under the pushed group screen, so
  // without this its cards keep the old participants until a pull-to-refresh. Exact, so the
  // other ['trips', ...] families are left alone.
  void queryClient.invalidateQueries({ queryKey: ['trips'], exact: true })
}

export function useAddGhostMember(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => addGhostMember(tripId, name),
    onSuccess: () => {
      invalidateMemberQueries(queryClient, tripId)
    },
  })
}

// Seeding the places of a trip that does not exist yet, so the trip id arrives with the mutation
// rather than with the hook. Sequential on purpose: add_ghost_member is rate limited per trip and
// counts against a 50-place cap, and the order the names were typed is the order they appear in.
// Resolves with the names that failed instead of throwing - losing a place the group can re-add in
// two taps must not cost them the trip they just created (spec 4.8).
export function useAddGhostMembers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ tripId, names }: { tripId: string; names: string[] }) => {
      const failed: string[] = []
      for (const name of names) {
        try {
          await addGhostMember(tripId, name)
        } catch {
          failed.push(name)
        }
      }
      return failed
    },
    onSuccess: (_failed, { tripId }) => {
      invalidateMemberQueries(queryClient, tripId)
    },
  })
}

export function useRenameGhostMember(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, name }: { memberId: string; name: string }) =>
      renameGhostMember(memberId, name),
    onSuccess: () => {
      invalidateMemberQueries(queryClient, tripId)
    },
  })
}

export function useDetachTripMember(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: detachTripMember,
    onSuccess: () => {
      invalidateMemberQueries(queryClient, tripId)
    },
  })
}
