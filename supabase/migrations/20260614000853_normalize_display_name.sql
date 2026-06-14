-- Better display names at signup. handle_new_user only checked our own `display_name` metadata key
-- (set by the email/password form) and otherwise fell back to the raw email local-part, so social
-- signups (Google/Apple, which provide full_name/name, not display_name) ended up named after their
-- email. Prefer the provider's real name, then a humanised email, then the raw local-part.

-- "jean.dupont75" -> "Jean Dupont": drop digits, turn separators into spaces, title-case, collapse
-- whitespace. Returns null when nothing readable is left (e.g. "123@..." -> null).
create or replace function private.humanize_email_name(_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(
      regexp_replace(
        initcap(
          regexp_replace(
            regexp_replace(split_part(coalesce(_email, ''), '@', 1), '[0-9]+', '', 'g'),
            '[._+\-]+', ' ', 'g'
          )
        ),
        '\s+', ' ', 'g'
      )
    ),
    ''
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(
        btrim(
          concat_ws(
            ' ',
            new.raw_user_meta_data ->> 'given_name',
            new.raw_user_meta_data ->> 'family_name'
          )
        ),
        ''
      ),
      private.humanize_email_name(new.email),
      -- Last resort so display_name is never null (e.g. an all-digit local-part): the raw
      -- local-part, exactly as the original trigger did.
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;
