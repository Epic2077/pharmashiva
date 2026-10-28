-- Medical Reference: source-backed citations on chat messages + optional
-- source-neutral cache table.
--
-- `chat_messages.references` stores only the source links a turn cited (title,
-- source, canonical URL). It never stores AI-generated medical claims as
-- authoritative facts, and it never stores patient information.
--
-- `medical_reference_cache` is an OPTIONAL persistence point for cached
-- reference records. The runtime uses an in-memory cache; this table exists so
-- a later integration can persist eligible records without changing shape. It
-- is only accessed server-side (service role), so no RLS policy is granted to
-- client roles.

alter table public.chat_messages
  add column if not exists references jsonb;

create table if not exists public.medical_reference_cache (
  id uuid primary key default gen_random_uuid(),
  -- Stable source key, e.g. 'medlineplus', 'pubmed', 'dailymed', 'rxnorm', 'pubchem'.
  source_name text not null,
  -- Identifier inside the source (setid, pmid, cid, rxcui, slug).
  external_id text not null,
  record_type text not null,
  title text not null default '',
  canonical_url text not null default '',
  -- Selected normalized fields or the raw source payload (per source terms).
  payload jsonb,
  language text,
  retrieved_at timestamptz not null default now(),
  source_updated_at timestamptz,
  expires_at timestamptz,
  constraint medical_reference_cache_unique
    unique (source_name, external_id)
);

create index if not exists medical_reference_cache_expires_idx
  on public.medical_reference_cache (expires_at);
