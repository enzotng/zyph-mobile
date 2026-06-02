-- Trip cover photo (Unsplash) for the trips list cards + dashboard hero.
-- We store the hotlinked URL + photographer attribution only (never the image
-- binary): Unsplash requires hotlinking and crediting the photographer. These
-- columns are populated server-side via the `trip-cover` Edge Function.
alter table public.trips
  add column if not exists cover_photo_url text,
  add column if not exists cover_photo_author text,
  add column if not exists cover_photo_author_url text;

-- Batched per-trip balance for the signed-in user, for the trips list cards
-- (avoids one get_trip_balances call per trip). Mirrors get_trip_balances'
-- paid - owed logic. Positive = others owe you, negative = you owe.
-- security invoker: RLS scopes the expense aggregates to the caller's own trips.
create or replace function public.get_my_trip_balances()
returns table (trip_id uuid, balance_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.trip_id,
    coalesce(p.paid, 0) - coalesce(s.owed, 0) as balance_cents
  from public.trip_members m
  left join (
    select paid_by, sum(base_amount_cents) as paid
    from public.expenses
    where deleted_at is null
    group by paid_by
  ) p on p.paid_by = m.id
  left join (
    select es.member_id, sum(es.share_cents) as owed
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.deleted_at is null
    group by es.member_id
  ) s on s.member_id = m.id
  where m.user_id = auth.uid();
$$;

revoke all on function public.get_my_trip_balances() from public;
revoke all on function public.get_my_trip_balances() from anon;
grant execute on function public.get_my_trip_balances() to authenticated;
