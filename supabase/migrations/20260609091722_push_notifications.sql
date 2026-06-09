-- Real push notifications. Two parts:
-- (1) public.push_tokens stores each device's Expo push token (token is the PK: signing in on a
--     shared device REASSIGNS the token to the current user, so the previous user stops receiving
--     that device's pushes). Written only through register_push_token (pins user_id to auth.uid()).
-- (2) An AFTER INSERT trigger on public.notifications fires the send-push Edge Function via pg_net,
--     so every in-app notification also becomes a lock-screen push. The trigger is best-effort and
--     fully fault-isolated: it runs inside the expense/settlement/etc. RPC transactions, so any
--     failure (no secret, pg_net down, Expo unreachable) is swallowed and NEVER rolls back the
--     notification. The send-push URL and its authorising secret are both read from Vault, never
--     committed; until they are set the dispatch simply no-ops.

create extension if not exists pg_net;
create extension if not exists supabase_vault;

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- A user only ever reads/removes their own tokens. Inserts/updates flow through
-- register_push_token (SECURITY DEFINER), so there is no client INSERT/UPDATE policy to spoof.
create policy "push_tokens_select_own" on public.push_tokens
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push_tokens_delete_own" on public.push_tokens
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Registers (or reassigns) a device token to the calling user.
create or replace function public.register_push_token(_token text, _platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;
  if _token is null or length(trim(_token)) = 0 then
    raise exception 'token is required';
  end if;
  if _platform not in ('ios', 'android', 'web') then
    raise exception 'invalid platform';
  end if;

  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (trim(_token), _uid, _platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public;
revoke all on function public.register_push_token(text, text) from anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Fan-out trigger: notification inserted -> send a push (best-effort, fault-isolated).
create or replace function private.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _secret text;
  _url text;
begin
  -- A push failure must NEVER roll back the notification (it is inserted inside other RPCs'
  -- transactions), so the whole body is wrapped and any error is swallowed.
  begin
    -- Respect the global push opt-out and skip recipients with no registered device.
    if exists (
      select 1 from public.notification_preferences p
      where p.user_id = new.recipient_id and not p.push_enabled
    ) then
      return null;
    end if;
    if not exists (
      select 1 from public.push_tokens t where t.user_id = new.recipient_id
    ) then
      return null;
    end if;

    -- The send-push URL and its shared secret both live in Vault, so nothing project-specific is
    -- committed (a fork / new environment just sets its own). Either one missing -> push is not
    -- wired yet; the in-app notification still stands.
    select decrypted_secret into _secret
    from vault.decrypted_secrets where name = 'push_hook_secret' limit 1;
    select decrypted_secret into _url
    from vault.decrypted_secrets where name = 'push_function_url' limit 1;
    if _secret is null or _url is null then
      return null;
    end if;

    perform net.http_post(
      url := _url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', _secret),
      body := jsonb_build_object('notificationId', new.id)
    );
  exception
    when others then
      return null;
  end;
  return null;
end;
$$;

create trigger trg_notifications_dispatch_push
  after insert on public.notifications
  for each row
  execute function private.dispatch_push();
