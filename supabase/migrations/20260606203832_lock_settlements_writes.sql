-- Lock trip_settlements to the RPC write path. The original settlements_all_member policy was
-- FOR ALL with a membership-only predicate, and Supabase's default grants give the authenticated
-- role INSERT/UPDATE/DELETE on the table - so any active member could write trip_settlements
-- directly over PostgREST and bypass record_settlement / reverse_settlement entirely (silently
-- void a payment with no settlement.reversed notification, un-reverse a row, tamper with
-- amount_cents/from_member/to_member, or delete history). The client only ever SELECTs this table
-- directly (listSettlements) and performs every mutation through the SECURITY DEFINER RPCs, so we
-- restrict it to SELECT and revoke write privileges. The RPCs run as the function owner and are
-- unaffected.

drop policy "settlements_all_member" on public.trip_settlements;

create policy "settlements_select_member" on public.trip_settlements
  for select to authenticated
  using (private.is_trip_member(trip_id));

revoke insert, update, delete on public.trip_settlements from authenticated;
revoke insert, update, delete on public.trip_settlements from anon;
