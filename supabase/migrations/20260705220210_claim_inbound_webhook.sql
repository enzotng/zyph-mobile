-- WHY: the receive-booking-email edge fn must dedup Brevo's at-least-once webhook delivery, but the
-- ledger lives in the private schema (not PostgREST-exposed, so the service-role client cannot INSERT
-- into it directly - same constraint as the calendar-feed resolver). This is the ONE public
-- SECURITY DEFINER path to claim a webhook id: it inserts and returns TRUE if this is the first time
-- we've seen the id, FALSE if it's a retry (so the caller can 200-and-stop without re-parsing).
-- Service-role only.
create or replace function public.claim_inbound_webhook(_provider_email_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.processed_inbound_webhooks (provider_email_id)
  values (_provider_email_id)
  on conflict (provider_email_id) do nothing;
  return found;
end;
$$;

revoke all on function public.claim_inbound_webhook(text) from public;
revoke all on function public.claim_inbound_webhook(text) from anon;
revoke all on function public.claim_inbound_webhook(text) from authenticated;
grant execute on function public.claim_inbound_webhook(text) to service_role;
