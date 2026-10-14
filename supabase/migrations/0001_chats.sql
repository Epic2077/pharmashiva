-- Chats + messages for Shiva consultations.
--
-- Auth is Supabase Auth (auth.users). Every chat belongs to exactly one user and
-- is protected by RLS so a signed-in user can only ever reach their own rows.
-- The app reads/writes these tables from server code; RLS is defence-in-depth.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  -- Lucide icon slug (see lib/chat/icons.ts). Validated in app code.
  icon text not null default 'general',
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'closed')),
  -- Which model the chat was last answered with.
  model text not null default 'flash' check (model in ('flash', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_user_updated_idx
  on public.chats (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  -- Reasoning trace for the Thinking tab (assistant only).
  thinking text,
  -- Last pipeline stage label, kept for debugging long turns.
  status text,
  -- Authoritative safety assessment for the turn.
  safety jsonb,
  -- Database-backed product recommendations for the turn.
  products jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_chat_created_idx
  on public.chat_messages (chat_id, created_at);

-- Keep chats.updated_at fresh so history can sort by recency.
create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chats_set_updated_at on public.chats;
create trigger chats_set_updated_at
  before update on public.chats
  for each row execute function public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists chats_owner_all on public.chats;
create policy chats_owner_all on public.chats
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists chat_messages_owner_all on public.chat_messages;
create policy chat_messages_owner_all on public.chat_messages
  for all
  to authenticated
  using (
    exists (
      select 1 from public.chats c
      where c.id = chat_messages.chat_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chats c
      where c.id = chat_messages.chat_id and c.user_id = auth.uid()
    )
  );

-- Table privileges for the Data API roles. RLS above is what actually filters
-- rows; these grants only allow the role to attempt the operation.
grant select, insert, update, delete on public.chats to authenticated;
grant select, insert, update, delete on public.chat_messages to authenticated;
