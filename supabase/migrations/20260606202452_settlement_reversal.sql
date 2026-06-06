-- Reverse a recorded settlement: an off-app payment was entered by mistake, so it is
-- soft-voided (status = 'reversed'), mirroring the trip_members convention. get_trip_balances
-- already nets only status = 'active' settlements, so reversing re-credits the balances with
-- no further change. Any active member of the trip may reverse, matching record_settlement's
-- collaborative model. Both parties are notified (settlement.reversed), actor excluded.

create or replace function public.reverse_settlement(_id uuid)
returns public.trip_settlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _row public.trip_settlements;
begin
  select * into _row
  from public.trip_settlements
  where id = _id;

  if _row.id is null then
    raise exception 'settlement not found';
  end if;

  if not exists (
    select 1 from public.trip_members
    where trip_id = _row.trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  if _row.status <> 'active' then
    raise exception 'settlement is not active';
  end if;

  update public.trip_settlements
  set status = 'reversed'
  where id = _id
  returning * into _row;

  perform private.notify(
    array(select user_id from public.trip_members where id = _row.from_member and status = 'active'),
    _uid, _row.trip_id, 'settlement.reversed',
    jsonb_build_object('settlementId', _row.id, 'amountCents', _row.amount_cents, 'role', 'from', 'counterpartyMemberId', _row.to_member)
  );
  perform private.notify(
    array(select user_id from public.trip_members where id = _row.to_member and status = 'active'),
    _uid, _row.trip_id, 'settlement.reversed',
    jsonb_build_object('settlementId', _row.id, 'amountCents', _row.amount_cents, 'role', 'to', 'counterpartyMemberId', _row.from_member)
  );

  return _row;
end;
$$;

revoke all on function public.reverse_settlement(uuid) from public;
revoke all on function public.reverse_settlement(uuid) from anon;
grant execute on function public.reverse_settlement(uuid) to authenticated;
