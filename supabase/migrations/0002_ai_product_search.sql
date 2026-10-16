-- AI-driven product search + catalog vocabulary.
--
-- The chat pipeline does NOT search with the customer's own words. The model
-- turns the case into a few short *product* queries (active ingredient, product
-- class, or category), and those queries are what hit the database.
--
-- This catalog is mostly Persian supplement/cosmetic listings, so the plain
-- `search_products` RPC is the wrong tool for that job:
--   * it ANDs the tokens (`plainto_tsquery`), so "eye drops" only matched rows
--     containing both words,
--   * it never looks at active ingredients — searching "ketorolac" returned 0,
--   * it never looks at category names — "ضد درد" (pain relief) returned 0.
--
-- `search_products_ai` fixes that for the assistant only:
--   * OR between tokens,
--   * matches product name / name_en / brand / description,
--   * matches active ingredient names (canonical + Persian),
--   * matches category names,
--   * ranks by how many tokens matched, so the most on-topic row wins.
--
-- The public site search (`search_products`) is deliberately left untouched.

-- `ingredients.persian_name` already has a trigram index; add the English one
-- and the missing category lookup index that the ingredient/category match
-- below relies on.
create index if not exists idx_ingredients_canonical_trgm
  on public.ingredients using gin (canonical_name gin_trgm_ops);

create index if not exists idx_product_categories_category
  on public.product_categories (category_id);

create or replace function public.search_products_ai(
  search_query text,
  result_limit integer default 20
)
returns table(id uuid, rank real)
language sql
stable
as $$
with tok as (
  select array(
    select distinct t
    from unnest(
      regexp_split_to_array(lower(coalesce(search_query, '')), '[^[:alnum:]]+')
    ) as t
    where length(t) >= 2
  ) as arr
),
scored as (
  select
    p.id,
    (
      select count(*)
      from unnest(tok.arr) as t
      where p.search_vector @@ to_tsquery('simple', t)
         or lower(p.name) like '%' || t || '%'
         or lower(coalesce(p.name_en, '')) like '%' || t || '%'
         or lower(coalesce(p.brand, '')) like '%' || t || '%'
         or exists (
              select 1
              from public.product_ingredients pi
              join public.ingredients i on i.id = pi.ingredient_id
              where pi.product_id = p.id
                and (
                  lower(coalesce(i.canonical_name, '')) like '%' || t || '%'
                  or lower(coalesce(i.persian_name, '')) like '%' || t || '%'
                )
            )
         or exists (
              select 1
              from public.product_categories pc
              join public.categories c on c.id = pc.category_id
              where pc.product_id = p.id
                and lower(c.name) like '%' || t || '%'
            )
    )::real as hits,
    -- Tokens come from `[[:alnum:]]` only, so joining with ` | ` is safe.
    -- The CASE keeps `to_tsquery` off the empty-array path.
    case
      when cardinality(tok.arr) > 0
        then ts_rank_cd(
               p.search_vector,
               to_tsquery('simple', array_to_string(tok.arr, ' | '))
             )::real
      else 0::real
    end as ts
  from public.products p, tok
)
select id, (hits * 3 + ts)::real as rank
from scored
where hits > 0
order by rank desc, id
limit greatest(result_limit, 1);
$$;

/**
 * Vocabulary of what this catalog actually contains: the most populated
 * category names and the most common active ingredients. The interpreter prompt
 * is grounded with this so the model proposes product queries that can really
 * match rows, instead of invented drug names the store does not carry.
 */
create or replace function public.catalog_vocabulary(lim integer default 60)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(name)
      from (
        select c.name
        from public.categories c
        join public.product_categories pc on pc.category_id = c.id
        where length(c.name) between 2 and 40
        group by c.name
        order by count(*) desc
        limit lim
      ) cat
    ), '[]'::jsonb),
    'ingredients', coalesce((
      select jsonb_agg(canonical_name)
      from (
        select i.canonical_name
        from public.ingredients i
        join public.product_ingredients pi on pi.ingredient_id = i.id
        where i.canonical_name is not null
          and length(i.canonical_name) between 2 and 40
          and i.canonical_name ~ '[[:alpha:]]'
        group by i.canonical_name
        order by count(*) desc
        limit lim
      ) ing
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.search_products_ai(text, integer) to anon, authenticated;
grant execute on function public.catalog_vocabulary(integer) to anon, authenticated;
