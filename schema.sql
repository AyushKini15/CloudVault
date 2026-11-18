-- CloudVault schema. Run in Supabase Dashboard > SQL Editor.

-- ========== TABLES ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 30),
  email text not null,
  role text not null default 'user' check (role in ('admin','user')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_description text,
  file_type text not null check (file_type in ('image','video','document')),
  mime_type text,
  file_size bigint not null default 0,
  storage_path text not null unique,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  is_available boolean not null default true,
  is_public boolean not null default false  -- true = visible to all active users
);

create table public.file_permissions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (file_id, user_id)
);

create table public.download_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  file_id uuid references public.files(id) on delete set null,
  user_email text,          -- snapshots survive deletions
  file_name text,
  downloaded_at timestamptz not null default now(),
  download_status text not null default 'success' check (download_status in ('success','failed'))
);

create index on public.files (created_at desc);
create index on public.files (file_type);
create index on public.file_permissions (user_id);
create index on public.file_permissions (file_id);
create index on public.download_logs (user_id);
create index on public.download_logs (file_id);
create index on public.download_logs (downloaded_at desc);

-- ========== HELPER FUNCTIONS ==========
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;

create or replace function public.can_access_file(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.is_active_user()
    and exists (
      select 1 from files f
      where f.id = fid and f.is_available
        and (f.is_public or exists (select 1 from file_permissions p where p.file_id = f.id and p.user_id = auth.uid()))
    )
  );
$$;

-- Role is ALWAYS 'user' on signup; never read from client metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, email)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1) || '_' || substr(new.id::text,1,4)),
          new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets login accept a username. Returns only the email for that username.
create or replace function public.email_for_username(p_username text) returns text
language sql stable security definer set search_path = public as $$
  select email from profiles where lower(username) = lower(p_username) limit 1;
$$;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- Records a download only if the caller is allowed to access the file.
create or replace function public.log_download(p_file_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f files; p profiles;
begin
  if not public.can_access_file(p_file_id) then raise exception 'Access denied'; end if;
  select * into f from files where id = p_file_id;
  select * into p from profiles where id = auth.uid();
  insert into download_logs (user_id, file_id, user_email, file_name, download_status)
  values (auth.uid(), p_file_id, p.email, f.file_name, 'success');
end $$;

create or replace function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return json_build_object(
    'users',     (select count(*) from profiles where role = 'user'),
    'files',     (select count(*) from files),
    'images',    (select count(*) from files where file_type = 'image'),
    'videos',    (select count(*) from files where file_type = 'video'),
    'documents', (select count(*) from files where file_type = 'document'),
    'downloads', (select count(*) from download_logs where download_status = 'success')
  );
end $$;

-- ========== ROW LEVEL SECURITY ==========
alter table public.profiles enable row level security;
alter table public.files enable row level security;
alter table public.file_permissions enable row level security;
alter table public.download_logs enable row level security;

-- profiles: read own or all (admin); only admin can update (so users can't change role/status)
create policy "profiles_select" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_admin_update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

-- files: users read only what they may access; admin manages everything
create policy "files_select" on public.files for select using (public.can_access_file(id));
create policy "files_admin_insert" on public.files for insert with check (public.is_admin());
create policy "files_admin_update" on public.files for update using (public.is_admin()) with check (public.is_admin());
create policy "files_admin_delete" on public.files for delete using (public.is_admin());

-- permissions
create policy "perm_select" on public.file_permissions for select using (user_id = auth.uid() or public.is_admin());
create policy "perm_admin_all" on public.file_permissions for all using (public.is_admin()) with check (public.is_admin());

-- download logs: read-only for clients; inserts happen only via log_download()
create policy "logs_select" on public.download_logs for select using (user_id = auth.uid() or public.is_admin());

-- ========== STORAGE (private bucket) ==========
insert into storage.buckets (id, name, public, file_size_limit)
values ('vault', 'vault', false, 524288000)   -- 500 MB per file; adjust to your plan
on conflict (id) do nothing;

create policy "vault_read" on storage.objects for select to authenticated using (
  bucket_id = 'vault' and (
    public.is_admin() or exists (select 1 from public.files f where f.storage_path = name and public.can_access_file(f.id))
  )
);
create policy "vault_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'vault' and public.is_admin());
create policy "vault_admin_update" on storage.objects for update to authenticated using (bucket_id = 'vault' and public.is_admin());
create policy "vault_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'vault' and public.is_admin());

-- ========== FIRST ADMIN (run AFTER creating the account via Auth > Users) ==========
-- update public.profiles set role = 'admin' where email = 'you@example.com';
