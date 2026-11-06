-- search_content invokes this helper, so both need EXECUTE for public search.
-- Both functions are SECURITY INVOKER; existing table RLS remains unchanged.
grant execute on function public.search_document(text) to anon, authenticated;
grant execute on function public.search_content(text, text, text, text, text, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
