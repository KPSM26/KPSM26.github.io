create table if not exists public.daydock_snapshots (
  sync_code text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.daydock_snapshots enable row level security;

drop policy if exists "daydock snapshots open access" on public.daydock_snapshots;

create policy "daydock snapshots open access"
on public.daydock_snapshots
for all
using (true)
with check (true);
