-- -- Darukade-backed catalog.
-- --
-- -- The existing `products` / `categories` / `ingredients` tables already hold a
-- -- Darukade crawl (7,394 products). Rather than build a second catalog, this
-- -- migration *extends* them with the fields the richer Darukade pages expose and
-- -- adds the normalised child tables the connector fills in:
-- --
-- --   * products        : source identity + structured detail (properties, usage,
-- --                       warnings, description, price before discount, hashes).
-- --   * product_variants: package sizes/prices/stock that Darukade models as
-- --                       "slaves" of a master product.
-- --   * product_relationships: source-provided related/same-brand/complementary/
-- --                       alternative links (stored by *source* id, because the
-- --                       related product may not be synced yet).
-- --   * product_price_history: lightweight price/availability snapshots.
-- --   * darukade_sync_runs / darukade_sync_queue: resumable, observable syncs.
-- --
-- -- It is idempotent and non-destructive: no existing column is dropped and
-- -- existing rows are only *backfilled* from data already present (`sku`).
-- --
-- -- Price units: Darukade returns prices in Toman but its JSON-LD claims "IRR".
-- -- The site displays Toman, and `orginalCost * 10` equals the JSON-LD price, so
-- -- the connector stores `currency = 'IRT'` and treats `price` as Toman.

-- -- ── products: source identity ───────────────────────────────────────────────

-- alter table public.products
--   add column if not exists provider text not null default 'darukade',
--   -- Stable numeric id Darukade uses in its product URLs and `D-<id>` skus.
--   add column if not exists source_product_id bigint,
--   add column if not exists master_id bigint,
--   add column if not exists product_code text,
--   -- Denormalized first real image so cards avoid parsing `image_urls`.
--   add column if not exists primary_image_url text,
--   -- Price before discount (only set when a genuine discount exists).
--   add column if not exists original_price numeric,
--   add column if not exists rating numeric,
--   add column if not exists review_count integer,
--   add column if not exists view_count text,
--   -- Structured detail extracted from the product page.
--   add column if not exists properties jsonb,
--   add column if not exists characteristics jsonb,
--   add column if not exists usage_info jsonb,
--   add column if not exists keep_conditions jsonb,
--   add column if not exists warnings jsonb,
--   add column if not exists usage_instructions text,
--   add column if not exists expert_review text,
--   add column if not exists description_html text,
--   -- Sync bookkeeping.
--   add column if not exists content_hash text,
--   add column if not exists synced_at timestamptz,
--   add column if not exists source_updated_at timestamptz,
--   add column if not exists source_category_path jsonb;

-- -- Backfill the stable source id from the `D-<id>` sku the previous crawl wrote.
-- update public.products
--    set source_product_id = substring(sku from 3)::bigint
--  where source_product_id is null
--    and sku ~ '^D-[0-9]+$';

-- -- Backfill `primary_image_url` from the first non-placeholder image, if any.
-- update public.products
--    set primary_image_url = (
--      select img
--      from jsonb_array_elements_text(coalesce(image_urls, '[]'::jsonb)) as t(img)
--      where img !~* 'noimage'
--      limit 1
--    )
--  where primary_image_url is null
--    and jsonb_typeof(coalesce(image_urls, '[]'::jsonb)) = 'array';

-- -- NOTE: non-partial on purpose — PostgREST's `upsert(onConflict:
-- -- 'provider,source_product_id')` can only target a plain unique index. NULLs
-- -- are distinct in Postgres unique indexes, so rows without a source id are
-- -- still allowed.
-- create unique index if not exists products_provider_source_product_id_key
--   on public.products (provider, source_product_id);

-- create index if not exists idx_products_source_product_id
--   on public.products (source_product_id);
-- create index if not exists idx_products_provider
--   on public.products (provider);
-- create index if not exists idx_products_availability
--   on public.products (availability);
-- create index if not exists idx_products_brand
--   on public.products (brand);

-- -- ── categories / ingredients: source identity ───────────────────────────────

-- alter table public.categories
--   add column if not exists source_category_id bigint,
--   add column if not exists name_en text;

-- create unique index if not exists categories_source_source_category_id_key
--   on public.categories (source_id, source_category_id)
--   where source_category_id is not null;

-- create index if not exists idx_categories_source_category_id
--   on public.categories (source_category_id);

-- alter table public.product_ingredients
--   add column if not exists raw_amount text,
--   add column if not exists serving_basis text,
--   add column if not exists source text;

-- -- ── product variants ────────────────────────────────────────────────────────

-- create table if not exists public.product_variants (
--   id uuid primary key default gen_random_uuid(),
--   product_id uuid not null references public.products (id) on delete cascade,
--   source_variant_id bigint not null,
--   type_id integer,
--   title text,
--   product_code text,
--   color text,
--   is_master boolean not null default false,
--   is_selected boolean not null default false,
--   original_price numeric,
--   price numeric,
--   discount_percent numeric,
--   currency text not null default 'IRT',
--   availability text,
--   stock_count integer,
--   max_sell integer,
--   expiration text,
--   image_urls jsonb not null default '[]'::jsonb,
--   raw jsonb not null default '{}'::jsonb,
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now(),
--   unique (product_id, source_variant_id)
-- );

-- create index if not exists idx_product_variants_product
--   on public.product_variants (product_id);
-- create index if not exists idx_product_variants_source
--   on public.product_variants (source_variant_id);

-- -- ── product relationships (source-provided associations) ────────────────────

-- create table if not exists public.product_relationships (
--   id uuid primary key default gen_random_uuid(),
--   product_id uuid not null references public.products (id) on delete cascade,
--   -- Kept as the *source* id because the related product may not be synced yet.
--   related_source_product_id bigint not null,
--   relationship text not null
--     check (relationship in ('related', 'same_brand', 'complementary', 'alternative', 'similar')),
--   title text,
--   url text,
--   position integer not null default 0,
--   source text not null default 'darukade',
--   updated_at timestamptz not null default now(),
--   unique (product_id, related_source_product_id, relationship)
-- );

-- create index if not exists idx_product_relationships_product
--   on public.product_relationships (product_id);
-- create index if not exists idx_product_relationships_related
--   on public.product_relationships (related_source_product_id);

-- -- ── price / availability history (lightweight snapshots) ────────────────────

-- create table if not exists public.product_price_history (
--   id bigserial primary key,
--   product_id uuid not null references public.products (id) on delete cascade,
--   variant_id uuid references public.product_variants (id) on delete cascade,
--   price numeric,
--   original_price numeric,
--   currency text not null default 'IRT',
--   availability text,
--   recorded_at timestamptz not null default now()
-- );

-- create index if not exists idx_product_price_history_product
--   on public.product_price_history (product_id, recorded_at desc);

-- -- ── sync observability / resumability ───────────────────────────────────────

-- create table if not exists public.darukade_sync_runs (
--   id uuid primary key default gen_random_uuid(),
--   mode text not null,
--   query text,
--   category text,
--   status text not null default 'running'
--     check (status in ('running', 'completed', 'failed', 'cancelled')),
--   dry_run boolean not null default false,
--   cursor jsonb not null default '{}'::jsonb,
--   stats jsonb not null default '{}'::jsonb,
--   error text,
--   started_at timestamptz not null default now(),
--   finished_at timestamptz
-- );

-- create index if not exists idx_darukade_sync_runs_started
--   on public.darukade_sync_runs (started_at desc);

-- -- A durable work queue so an interrupted enrichment can resume without
-- -- re-discovering the catalog. Discovery enqueues; enrichment drains.
-- create table if not exists public.darukade_sync_queue (
--   source_product_id bigint primary key,
--   product_url text not null,
--   status text not null default 'pending'
--     check (status in ('pending', 'done', 'failed', 'skipped')),
--   attempts integer not null default 0,
--   last_error text,
--   queued_at timestamptz not null default now(),
--   updated_at timestamptz not null default now()
-- );

-- create index if not exists idx_darukade_sync_queue_status
--   on public.darukade_sync_queue (status, updated_at);

-- -- Keep `updated_at` fresh on the new tables (reuses public.set_updated_at()).
-- drop trigger if exists product_variants_set_updated_at on public.product_variants;
-- create trigger product_variants_set_updated_at
--   before update on public.product_variants
--   for each row execute function public.set_updated_at();

-- -- ── Category product listing (pagination + sort + count, DB-side) ───────────

-- create or replace function public.list_category_products(
--   category_ids uuid[],
--   sort text default 'relevance',
--   p_limit integer default 24,
--   p_offset integer default 0,
--   brand_filter text default null,
--   in_stock_only boolean default false
-- )
-- returns table(
--   id uuid,
--   price numeric,
--   availability text,
--   rank real,
--   total_count bigint
-- )
-- language sql
-- stable
-- as $$
--   with matched as (
--     select distinct
--       p.id,
--       p.price,
--       p.availability,
--       p.name,
--       p.brand,
--       coalesce(p.rating, 0)::real as rating
--     from public.products p
--     join public.product_categories pc on pc.product_id = p.id
--     where pc.category_id = any(category_ids)
--       and (brand_filter is null or p.brand = brand_filter)
--       and (not in_stock_only or p.availability = 'InStock')
--   )
--   select
--     id,
--     price,
--     availability,
--     rating as rank,
--     count(*) over () as total_count
--   from matched
--   order by
--     case when sort = 'name' then name end asc nulls last,
--     case when sort = 'price_asc' then price end asc nulls last,
--     case when sort = 'price_desc' then price end desc nulls last,
--     case when sort = 'rating' then rating end desc nulls last,
--     case when sort = 'availability' then (availability = 'InStock') end desc nulls last,
--     name asc
--   limit greatest(p_limit, 1)
--   offset greatest(p_offset, 0);
-- $$;

-- grant execute on function public.list_category_products(uuid[], text, integer, integer, text, boolean)
--   to anon, authenticated;

-- -- ── Ingredient search (name/alias + product counts) ─────────────────────────

-- create or replace function public.search_ingredients(
--   search_query text,
--   result_limit integer default 24
-- )
-- returns table(
--   id uuid,
--   canonical_name text,
--   persian_name text,
--   aliases jsonb,
--   product_count bigint
-- )
-- language sql
-- stable
-- as $$
--   with tok as (
--     select array(
--       select distinct t
--       from unnest(
--         regexp_split_to_array(lower(coalesce(search_query, '')), '[^[:alnum:]]+')
--       ) as t
--       where length(t) >= 2
--     ) as arr
--   )
--   select
--     i.id,
--     i.canonical_name,
--     i.persian_name,
--     coalesce(i.aliases, '[]'::jsonb) as aliases,
--     count(distinct pi.product_id) as product_count
--   from public.ingredients i
--   left join public.product_ingredients pi on pi.ingredient_id = i.id
--   cross join tok
--   where cardinality(tok.arr) > 0
--     and exists (
--       select 1
--       from unnest(tok.arr) as t
--       where lower(coalesce(i.canonical_name, '')) like '%' || t || '%'
--          or lower(coalesce(i.persian_name, '')) like '%' || t || '%'
--          or exists (
--               select 1
--               from jsonb_array_elements_text(coalesce(i.aliases, '[]'::jsonb)) as a(alias)
--               where lower(a.alias) like '%' || t || '%'
--             )
--     )
--   group by i.id, i.canonical_name, i.persian_name, i.aliases
--   order by product_count desc, i.canonical_name asc
--   limit greatest(result_limit, 1);
-- $$;

-- grant execute on function public.search_ingredients(text, integer) to anon, authenticated;

-- -- ── Catalog stats (for sync reports) ────────────────────────────────────────

-- create or replace function public.catalog_stats()
-- returns jsonb
-- language sql
-- stable
-- as $$
--   select jsonb_build_object(
--     'products', (select count(*) from public.products),
--     'variants', (select count(*) from public.product_variants),
--     'ingredients', (select count(*) from public.ingredients),
--     'categories', (select count(*) from public.categories),
--     'relationships', (select count(*) from public.product_relationships),
--     'in_stock', (select count(*) from public.products where availability = 'InStock'),
--     'with_source_id', (select count(*) from public.products where source_product_id is not null),
--     'enriched', (select count(*) from public.products where content_hash is not null)
--   );
-- $$;

-- grant execute on function public.catalog_stats() to anon, authenticated;
