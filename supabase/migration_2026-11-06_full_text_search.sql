-- Full-text and Arabic-friendly fuzzy search. Review and apply manually in Supabase.
-- Requires migration_2026-10-30_confirmed_members.sql (email_confirmed).
-- No SECURITY DEFINER functions: every query runs with the caller's existing RLS policies.
create extension if not exists pg_trgm;

create or replace function public.search_document(value text)
returns text language sql immutable strict parallel safe as $$
  select lower(regexp_replace(coalesce(value, ''), '[\u064B-\u065F\u0670ـ]', '', 'g'));
$$;

alter table public.projects
  add column if not exists search_vector tsvector
  generated always as (to_tsvector('simple', public.search_document(concat_ws(' ', title, description, category)))) stored;
create index if not exists projects_search_vector_idx on public.projects using gin(search_vector);
create index if not exists projects_search_title_trgm_idx on public.projects using gin(public.search_document(title) gin_trgm_ops);
create index if not exists projects_search_body_trgm_idx on public.projects using gin(public.search_document(description) gin_trgm_ops);
create index if not exists profiles_search_trgm_idx on public.profiles using gin(public.search_document(concat_ws(' ', username, full_name, specialty)) gin_trgm_ops);
create index if not exists posts_search_trgm_idx on public.posts using gin(public.search_document(content) gin_trgm_ops);

-- Cap untrusted inputs and keep offsets bounded; callers can browse at most 100 pages.
create or replace function public.search_content(
  p_tab text,
  p_term text default '',
  p_category text default '',
  p_specialty text default '',
  p_sort text default 'relevance',
  p_page integer default 1,
  p_page_size integer default 12
)
returns table (
  id uuid,
  user_id uuid,
  kind text,
  title text,
  body text,
  category text,
  created_at timestamptz,
  author jsonb,
  relevance real,
  total_count bigint
)
language sql stable security invoker set search_path = public as $$
  with input as (
    select left(trim(p_term), 100) as term,
           nullif(left(trim(p_category), 100), '') as category,
           nullif(left(trim(p_specialty), 100), '') as specialty,
           case when p_sort in ('newest', 'oldest') and trim(p_term) = '' then p_sort
                when p_sort = 'newest' then 'newest' else 'relevance' end as sort,
           least(greatest(coalesce(p_page, 1), 1), 100) - 1 as page,
           least(greatest(coalesce(p_page_size, 12), 1), 50) as page_size
  ), tokens as (
    select array_to_string(array_agg(token), ' & ') as ts_query
    from (select distinct token from input, unnest(string_to_array(public.search_document(input.term), ' ')) as token
          where length(token) > 0 limit 12) words
  ), public_profiles as (
    select * from public.profiles p
    where p.email_confirmed
  ), project_hits as (
    select p.id, p.user_id, 'projects'::text as kind, p.title, p.description as body,
           p.category, p.created_at,
           greatest(ts_rank(p.search_vector, to_tsquery('simple', tokens.ts_query)),
                    similarity(public.search_document(concat_ws(' ', p.title, p.description, p.category)), public.search_document(input.term))) as score
    from public.projects p, input, tokens
    where p_tab = 'projects'
      and (input.category is null or p.category = input.category)
      and (input.specialty is null or exists (
        select 1 from public_profiles profile where profile.id = p.user_id and profile.specialty = input.specialty
      ))
      and (input.term = '' or length(input.term) < 2
        or (tokens.ts_query is not null and p.search_vector @@ to_tsquery('simple', tokens.ts_query))
        or public.search_document(coalesce(p.title, '')) % public.search_document(input.term)
        or public.search_document(coalesce(p.description, '')) % public.search_document(input.term)
        or public.search_document(coalesce(p.category, '')) % public.search_document(input.term)
        or public.search_document(coalesce(p.title, '')) ilike '%' || replace(replace(public.search_document(input.term), '\', '\\'), '%', '\%') || '%' escape '\'
        or public.search_document(coalesce(p.description, '')) ilike '%' || replace(replace(public.search_document(input.term), '\', '\\'), '%', '\%') || '%' escape '\')
  ), member_hits as (
    select p.id, p.id as user_id, 'members'::text as kind,
           coalesce(nullif(p.full_name, ''), p.username) as title,
           p.username as body, p.specialty as category, null::timestamptz as created_at,
           greatest(similarity(public.search_document(concat_ws(' ', p.username, p.full_name, p.specialty)), public.search_document(input.term)),
                    similarity(public.search_document(p.username), public.search_document(input.term))) as score
    from public_profiles p, input
    where p_tab = 'members'
      and (input.specialty is null or p.specialty = input.specialty)
      and (input.term = '' or length(input.term) < 2
        or public.search_document(p.username) % public.search_document(input.term)
        or public.search_document(p.full_name) % public.search_document(input.term)
        or public.search_document(coalesce(p.specialty, '')) % public.search_document(input.term)
        or public.search_document(concat_ws(' ', p.username, p.full_name, p.specialty)) ilike '%' || replace(replace(public.search_document(input.term), '\', '\\'), '%', '\%') || '%' escape '\')
  ), post_hits as (
    select p.id, p.user_id, 'posts'::text as kind, null::text as title, p.content as body,
           null::text as category, p.created_at,
           similarity(public.search_document(p.content), public.search_document(input.term)) as score
    from public.posts p, input
    where p_tab = 'posts'
      and (input.term = '' or length(input.term) < 2
        or public.search_document(p.content) % public.search_document(input.term)
        or public.search_document(p.content) ilike '%' || replace(replace(public.search_document(input.term), '\', '\\'), '%', '\%') || '%' escape '\')
  ), results as (
    select * from project_hits union all select * from member_hits union all select * from post_hits
  )
  select r.id, r.user_id, r.kind, r.title, r.body, r.category, r.created_at,
         jsonb_build_object('username', author.username, 'full_name', author.full_name, 'specialty', author.specialty),
         r.score,
         count(*) over() as total_count
  from results r cross join input left join public.profiles author on author.id = r.user_id
  order by case when input.sort = 'relevance' then -r.score else 0 end,
           case when input.sort = 'oldest' then extract(epoch from r.created_at) end asc nulls last,
           case when input.sort <> 'oldest' then extract(epoch from r.created_at) end desc nulls last,
           r.title asc nulls last, r.id
  limit input.page_size offset input.page * input.page_size;
$$;

revoke all on function public.search_document(text) from public, anon, authenticated;
grant execute on function public.search_content(text, text, text, text, text, integer, integer) to anon, authenticated;

-- Request fresh RPC and generated-column metadata after applying this migration.
notify pgrst, 'reload schema';
