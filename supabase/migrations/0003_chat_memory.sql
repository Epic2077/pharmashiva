-- Per-chat case memory.
--
-- A consultation is a conversation about ONE case, so facts stated on one turn
-- ("Sarah has eye pain") must stay available on later turns ("it gets worse day
-- by day" = the eye pain is worsening). This column holds the accumulated case
-- memory for the chat so red-flag checks and product search always see the whole
-- case, not just the last sentence.
--
-- The value is written by the server pipeline (append-only merge); the model can
-- add facts but never remove them, so a red flag can't be silently downgraded.

alter table public.chats
  add column if not exists memory jsonb not null default '{}'::jsonb;
