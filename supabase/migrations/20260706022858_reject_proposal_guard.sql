-- WHY: reject_import_proposal silently succeeded on a stale proposal (0 rows updated -> void, no
-- error), unlike validate_import_proposal which raises when the row is no longer pending. Two
-- members on a cached pending copy: A validates (events land), B rejects the stale copy -> B's
-- reject "succeeds" while the events are actually live. Add the same not-found guard so the client
-- surfaces an error instead of a false success.
create or replace function public.reject_import_proposal(_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _trip_id uuid;
begin
  select trip_id into _trip_id from public.import_proposals where id = _proposal_id;
  if _trip_id is null then
    raise exception 'proposal not found';
  end if;

  if not exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _uid and status = 'active'
  ) then
    raise exception 'not an active member of this trip';
  end if;

  update public.import_proposals
  set status = 'rejected', rejected_by = _uid, rejected_at = now(), sender_email = null
  where id = _proposal_id and status in ('pending', 'parsing', 'failed');

  if not found then
    raise exception 'proposal is no longer actionable';
  end if;
end;
$$;

revoke all on function public.reject_import_proposal(uuid) from public;
revoke all on function public.reject_import_proposal(uuid) from anon;
grant execute on function public.reject_import_proposal(uuid) to authenticated;
