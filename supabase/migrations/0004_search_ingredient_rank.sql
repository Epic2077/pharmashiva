-- Ingredient-aware ranking for the catalog search used by both the site search
-- page and the assistant's product retrieval.
--
-- Before this migration every match type contributed equally to `hits`, so a
-- product whose *name* merely contained the term outranked products that
-- actually used the term as an active ingredient:
--   * "collagen" surfaced creams called "collagen" and pushed most of the 15
--     collagen-containing products out of the top 20,
--   * "کلاژن" returned none of its 3 real products,
--   * "Caffeine" returned 6 of 12, "کافئین" returned 0 of 1.
--
-- Now each field is counted separately and weighted:
--   * product text (name / name_en / brand / search_vector)  x3
--   * active-ingredient name (canonical + Persian)           x8
--   * category name                                          x4
-- plus the original full-text rank as a tie-breaker.
--
-- Ingredient names are matched on word boundaries so short Persian words stop
-- matching unrelated ones ("روی" no longer matches "رویال ژلی", "مس" no longer
-- matches "مسموم"). Product/category names keep substring matching so compound
-- Persian words still match ("چروک" still finds "ضدچروک").

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
    )::real as name_hits,
    (
      select count(*)
      from unnest(tok.arr) as t
      where exists (
        select 1
        from public.product_ingredients pi
        join public.ingredients i on i.id = pi.ingredient_id
        where pi.product_id = p.id
          and (
            lower(coalesce(i.canonical_name, '')) ~ ('[[:<:]]' || t || '[[:>:]]')
            or lower(coalesce(i.persian_name, '')) ~ ('[[:<:]]' || t || '[[:>:]]')
          )
      )
    )::real as ingredient_hits,
    (
      select count(*)
      from unnest(tok.arr) as t
      where exists (
        select 1
        from public.product_categories pc
        join public.categories c on c.id = pc.category_id
        where pc.product_id = p.id
          and lower(c.name) like '%' || t || '%'
      )
    )::real as category_hits,
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
select
  id,
  (name_hits * 3 + ingredient_hits * 8 + category_hits * 4 + ts)::real as rank
from scored
where (name_hits + ingredient_hits + category_hits) > 0
order by rank desc, id
limit greatest(result_limit, 1);
$$;

grant execute on function public.search_products_ai(text, integer) to anon, authenticated;
