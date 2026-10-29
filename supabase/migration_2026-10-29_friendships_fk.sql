-- Fix friendships -> profiles relationships (idempotent, no data deleted)
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
    where con.conrelid = 'public.friendships'::regclass
      and con.contype = 'f'
      and a.attname in ('requester_id','addressee_id')
  loop
    execute format('alter table public.friendships drop constraint %I', c.conname);
  end loop;

  alter table public.friendships
    add constraint friendships_requester_id_fkey
    foreign key (requester_id) references public.profiles(id) on delete cascade;
  alter table public.friendships
    add constraint friendships_addressee_id_fkey
    foreign key (addressee_id) references public.profiles(id) on delete cascade;
end $$;

notify pgrst, 'reload schema';