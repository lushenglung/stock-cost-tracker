create table public.stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  stock_id uuid not null references public.stocks(id) on delete cascade,
  kind text not null check (kind in ('opening','buy','sell')),
  shares numeric not null check (shares > 0),
  unit_price numeric not null check (unit_price >= 0),
  amount numeric not null check (amount >= 0),
  trade_date date,
  created_at timestamptz not null default now()
);

alter table public.stocks enable row level security;
alter table public.transactions enable row level security;

revoke all on public.stocks from anon, authenticated;
revoke all on public.transactions from anon, authenticated;
grant select, insert, update, delete on public.stocks to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

create policy "Select own stocks" on public.stocks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own stocks" on public.stocks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own stocks" on public.stocks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own stocks" on public.stocks for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Select own transactions" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own transactions" on public.transactions for insert to authenticated with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.stocks where stocks.id = stock_id and stocks.user_id = (select auth.uid()))
);
create policy "Update own transactions" on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.stocks where stocks.id = stock_id and stocks.user_id = (select auth.uid()))
);
create policy "Delete own transactions" on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

create index stocks_user_id_idx on public.stocks(user_id);
create index transactions_user_id_idx on public.transactions(user_id);
create index transactions_stock_id_idx on public.transactions(stock_id);
