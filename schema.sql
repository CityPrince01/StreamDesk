-- StreamDesk : structure de la base de données
-- À copier-coller dans Supabase > SQL Editor > New query, puis cliquer sur "Run"

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform text not null,
  slots integer not null default 5,
  email text default '',
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  client_name text not null,
  contact text default '',
  profile_name text not null,
  formula text default 'Standard',
  pin text default '',
  start_date date not null,
  end_date date not null,
  paid boolean not null default false,
  blocked boolean not null default false,
  price numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Sécurité : chaque utilisateur ne voit et ne modifie que ses propres données
alter table accounts enable row level security;
alter table subscriptions enable row level security;

create policy "accounts_owner_select" on accounts for select using (auth.uid() = user_id);
create policy "accounts_owner_insert" on accounts for insert with check (auth.uid() = user_id);
create policy "accounts_owner_update" on accounts for update using (auth.uid() = user_id);
create policy "accounts_owner_delete" on accounts for delete using (auth.uid() = user_id);

create policy "subscriptions_owner_select" on subscriptions for select using (auth.uid() = user_id);
create policy "subscriptions_owner_insert" on subscriptions for insert with check (auth.uid() = user_id);
create policy "subscriptions_owner_update" on subscriptions for update using (auth.uid() = user_id);
create policy "subscriptions_owner_delete" on subscriptions for delete using (auth.uid() = user_id);
