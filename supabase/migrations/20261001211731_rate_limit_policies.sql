-- Rate limits are decided by the server: each bucket's ceiling and window live in a policy table,
-- and check_rate_limit(_bucket) reads them. The three-argument form stays for the edge functions
-- already deployed with it, and ignores its numbers.
--
-- check_rate_limit (both forms) is generated from 20260610114844_rate_limits.sql; add_ghost_member
-- and rename_ghost_member are reproduced VERBATIM from 20260813134348_harden_actor_names.sql with
-- ONLY their limiter call changed.

create table private.rate_limit_policies (
  bucket text primary key,
  max_calls integer not null check (max_calls > 0),
  window_seconds integer not null check (window_seconds > 0)
);

alter table private.rate_limit_policies enable row level security;

insert into private.rate_limit_policies (bucket, max_calls, window_seconds) values
  ('copilot', 20, 60),
  ('poi-search', 30, 60),
  ('poi-photo', 60, 60),
  ('place-search', 40, 60),
  ('parse-receipt-email', 10, 60),
  ('generate-packing', 10, 60),
  ('upload-avatar', 10, 60),
  ('upload-trip-cover', 10, 60),
  ('trip-cover', 15, 60),
  ('claim-options', 30, 3600),
  ('add-ghost', 30, 3600),
  ('rename-ghost', 30, 3600);

create or replace function public.check_rate_limit(_bucket text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _count integer;
  _policy private.rate_limit_policies;
begin
  if _uid is null or _bucket is null or length(_bucket) > 100 then
    return false;
  end if;

  -- A bucket is a policy name, optionally scoped after a colon ('add-ghost:<trip id>').
  select * into _policy
  from private.rate_limit_policies
  where bucket = split_part(_bucket, ':', 1);

  if _policy.bucket is null then
    return false;
  end if;

  insert into private.rate_limits as r (user_id, bucket, window_start, count)
  values (_uid, _bucket, now(), 1)
  on conflict (user_id, bucket) do update
    set
      count = case
        when r.window_start < now() - make_interval(secs => _policy.window_seconds) then 1
        else r.count + 1
      end,
      window_start = case
        when r.window_start < now() - make_interval(secs => _policy.window_seconds) then now()
        else r.window_start
      end
  returning count into _count;

  return _count <= _policy.max_calls;
end;
$$;

revoke all on function public.check_rate_limit(text) from public;
revoke all on function public.check_rate_limit(text) from anon;
grant execute on function public.check_rate_limit(text) to authenticated;

create or replace function public.check_rate_limit(
  _bucket text,
  _limit integer,
  _window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.check_rate_limit(_bucket);
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
revoke all on function public.check_rate_limit(text, integer, integer) from anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

create or replace function public.add_ghost_member(_trip_id uuid, _name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trimmed text := btrim(_name);
  -- Computed once and used for BOTH the stored alias and the payload, so the members list
  -- and the notification can never show the same place under two different names.
  _clean text := private.clean_name(_trimmed);
  _member_id uuid;
  _actor_name text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_trip_member(_trip_id) then
    raise exception 'not a trip member';
  end if;

  -- btrim(null) is null and no comparison against it is true, so without the null test a null name
  -- falls through this whole check and surfaces as a trip_members_ghost_has_name violation.
  if _trimmed is null or _trimmed = '' or char_length(_trimmed) > 80 or _clean is null then
    raise exception 'invalid name';
  end if;

  if not public.check_rate_limit('add-ghost:' || _trip_id) then
    raise exception 'rate limited';
  end if;

  -- Anti-abuse cap on the claim list, the balances and the member.added fan-out - not a financial
  -- invariant, so it is deliberately unlocked: two concurrent inserts can reach 51.
  if (select count(*) from public.trip_members
      where trip_id = _trip_id and status = 'active'::public.member_status) >= 50 then
    raise exception 'member limit reached';
  end if;

  insert into public.trip_members (trip_id, user_id, role, status, display_name)
  values (_trip_id, null, 'member', 'active', _clean)
  returning id into _member_id;

  select private.clean_name(coalesce(p.display_name, m.display_name)) into _actor_name
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.trip_id = _trip_id and m.user_id = _uid;

  perform private.notify(
    array(select tm.user_id from public.trip_members tm
          where tm.trip_id = _trip_id and tm.status = 'active'),
    _uid, _trip_id, 'member.added',
    jsonb_build_object('memberId', _member_id, 'name', _clean, 'actorName', _actor_name)
  );

  return _member_id;
end;
$$;

revoke all on function public.add_ghost_member(uuid, text) from public;
revoke all on function public.add_ghost_member(uuid, text) from anon;
grant execute on function public.add_ghost_member(uuid, text) to authenticated;

create or replace function public.rename_ghost_member(_member_id uuid, _name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trimmed text := btrim(_name);
  _clean text := private.clean_name(_trimmed);
  _ghost record;
  _actor_name text;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  -- A claimed place carries the name of the account holding it and a removed one has left the
  -- group: widening this target would let a member rewrite either.
  select trip_id, display_name into _ghost
  from public.trip_members
  where id = _member_id
    and user_id is null
    and status = 'active'::public.member_status;

  if not found then
    raise exception 'not a renamable ghost';
  end if;

  if not private.is_trip_member(_ghost.trip_id) then
    raise exception 'not a trip member';
  end if;

  if _trimmed is null or _trimmed = '' or char_length(_trimmed) > 80 or _clean is null then
    raise exception 'invalid name';
  end if;

  -- Same bounded surface as add_ghost_member: open to every active member, and each call fans a
  -- notification out to the whole trip, so an unbounded rename loop is a spam vector.
  if not public.check_rate_limit('rename-ghost:' || _ghost.trip_id) then
    raise exception 'rate limited';
  end if;

  update public.trip_members
  set display_name = _clean
  where id = _member_id;

  select private.clean_name(coalesce(p.display_name, m.display_name)) into _actor_name
  from public.trip_members m
  left join public.profiles p on p.id = m.user_id
  where m.trip_id = _ghost.trip_id and m.user_id = _uid;

  -- Renaming a place that already carries financial history is legitimate but must be as visible
  -- as a claim, which is the only defence D8 keeps against a malicious rename.
  perform private.notify(
    array(select tm.user_id from public.trip_members tm
          where tm.trip_id = _ghost.trip_id and tm.status = 'active'),
    _uid, _ghost.trip_id, 'member.renamed',
    jsonb_build_object('memberId', _member_id,
      'oldName', private.clean_name(_ghost.display_name),
      'newName', _clean, 'actorName', _actor_name)
  );
end;
$$;

revoke all on function public.rename_ghost_member(uuid, text) from public;
revoke all on function public.rename_ghost_member(uuid, text) from anon;
grant execute on function public.rename_ghost_member(uuid, text) to authenticated;
