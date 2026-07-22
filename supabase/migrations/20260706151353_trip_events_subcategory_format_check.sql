-- Defense-in-depth bound on trip_events.subcategory. Unlike `category` (CHECK-constrained to the 8
-- roots), `subcategory` is intentionally NOT enumerated in the DB (app-owned taxonomy, Option A: the
-- leaf vocabulary evolves in the TS module without a migration). But leaving it fully free-text lets
-- a direct PostgREST/RPC caller (bypassing the client zod + resolveCode) persist an arbitrary,
-- unbounded string. This CHECK guards the SHAPE and LENGTH on every write path (direct insert/update,
-- the validate_import_proposal RPC, and both edge functions) without enumerating leaves: a dotted
-- lowercase code, max 40 chars. Closed-vocabulary MEMBERSHIP stays enforced upstream (edge normalize
-- allowlist + client isValidSubcategory). Existing rows only hold 'transport.flight'/'other.event'/
-- NULL, so this validates cleanly.
alter table public.trip_events
  add constraint trip_events_subcategory_format_check
  check (
    subcategory is null
    or (subcategory ~ '^[a-z]+\.[a-z0-9_]+$' and char_length(subcategory) <= 40)
  );
