-- Unified taxonomy on the expense ledger (Lot 2). expenses.category already holds root codes
-- (food/transport/...), so we only ADD the optional dotted subcategory and WIDEN the category CHECK
-- to the full 8 roots (adds health, fees). category stays NULLABLE (an expense may be uncategorised).
-- subcategory gets the same shape/length bound as trip_events (the app owns the leaf vocabulary; the
-- DB guards shape only). The write RPCs are updated in the next migration.

alter table public.expenses drop constraint expenses_category_check;

alter table public.expenses
  add constraint expenses_category_check
  check (
    category is null
    or category in ('transport', 'lodging', 'food', 'activity', 'shopping', 'health', 'fees', 'other')
  );

alter table public.expenses add column subcategory text;

alter table public.expenses
  add constraint expenses_subcategory_format_check
  check (
    subcategory is null
    or (subcategory ~ '^[a-z]+\.[a-z0-9_]+$' and char_length(subcategory) <= 40)
  );
