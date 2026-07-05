-- WHY: "one live token per (trip, member)" was only procedural (the create RPC revokes then
-- inserts) - two concurrent creates could leave two live tokens. Make the invariant declarative
-- with a partial UNIQUE index; it also serves the same lookups as the plain index it replaces.
drop index private.calendar_feed_tokens_live_idx;
create unique index calendar_feed_tokens_live_key
  on private.calendar_feed_tokens (trip_id, user_id)
  where revoked_at is null;
