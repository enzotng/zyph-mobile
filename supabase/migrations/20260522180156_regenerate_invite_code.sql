-- Regenerate a trip's invite code (US-019). Owner-only; SECURITY DEFINER so the
-- function can update the row after asserting ownership. Retries on the unlikely
-- unique collision and returns the fresh code.
create or replace function public.regenerate_invite_code(_trip_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _owner uuid;
  _code text;
begin
  select owner_id into _owner from public.trips where id = _trip_id;

  if _owner is null then
    raise exception 'trip not found';
  end if;

  if _owner <> auth.uid() then
    raise exception 'only the trip owner can regenerate the invite code';
  end if;

  loop
    _code := encode(extensions.gen_random_bytes(6), 'hex');
    begin
      update public.trips set invite_code = _code where id = _trip_id;
      return _code;
    exception when unique_violation then
      -- collision: loop and try another code
    end;
  end loop;
end;
$$;

revoke all on function public.regenerate_invite_code(uuid) from public;
revoke all on function public.regenerate_invite_code(uuid) from anon;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
