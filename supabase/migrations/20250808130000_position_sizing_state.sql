/*
  # Position sizing per-symbol state

  - Tracks current decision-tree node per symbol group (e.g., USDJPY, XAUUSD)
  - Used to compute dynamic risk% for new alerts and after marking outcomes
*/

create table if not exists public.position_sizing_state (
  group_key text primary key,
  current_node text not null default 'Start',
  updated_at timestamptz not null default now()
);

alter table public.position_sizing_state enable row level security;

-- Allow public read
drop policy if exists "Allow public read for position sizing state" on public.position_sizing_state;
create policy "Allow public read for position sizing state"
  on public.position_sizing_state
  for select
  to public
  using (true);

-- Allow public upsert (for anon frontend)
drop policy if exists "Allow public upsert for position sizing state" on public.position_sizing_state;
create policy "Allow public upsert for position sizing state"
  on public.position_sizing_state
  for insert
  to public
  with check (true);

drop policy if exists "Allow public update for position sizing state" on public.position_sizing_state;
create policy "Allow public update for position sizing state"
  on public.position_sizing_state
  for update
  to public
  using (true)
  with check (true);

-- Keep updated_at current
create or replace function public.update_updated_at_position_sizing()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_position_sizing_updated_at on public.position_sizing_state;
create trigger trg_update_position_sizing_updated_at
  before update on public.position_sizing_state
  for each row
  execute function public.update_updated_at_position_sizing();


