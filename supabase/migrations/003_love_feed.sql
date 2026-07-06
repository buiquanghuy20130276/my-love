-- Drop table challenges
drop table if exists public.love_challenges cascade;

-- Create Feed Posts Table
create table if not exists public.love_feed_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  author_name text not null,
  author_avatar_url text,
  content text,
  images text[] default '{}'::text[] not null,
  layout_type text not null default 'grid-equal' check (layout_type in ('grid-equal', 'left-large', 'top-large')),
  created_at timestamptz default now() not null
);

-- Enable RLS for feed posts
alter table public.love_feed_posts enable row level security;
create policy "Authenticated users can manage feed posts" 
  on public.love_feed_posts for all 
  to authenticated 
  using (true);

-- Create Feed Reactions Table
create table if not exists public.love_feed_reactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.love_feed_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now() not null,
  unique (post_id, user_id)
);

-- Enable RLS for feed reactions
alter table public.love_feed_reactions enable row level security;
create policy "Authenticated users can manage feed reactions" 
  on public.love_feed_reactions for all 
  to authenticated 
  using (true);

-- Create Feed Comments Table
create table if not exists public.love_feed_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.love_feed_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  author_name text not null,
  author_avatar_url text,
  content text not null,
  created_at timestamptz default now() not null
);

-- Enable RLS for feed comments
alter table public.love_feed_comments enable row level security;
create policy "Authenticated users can manage feed comments" 
  on public.love_feed_comments for all 
  to authenticated 
  using (true);

-- Enable Supabase Realtime replication on these tables
do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr 
    join pg_class c on pr.prrelid = c.oid 
    join pg_namespace n on c.relnamespace = n.oid 
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public' 
      and c.relname = 'love_feed_posts'
  ) then
    alter publication supabase_realtime add table public.love_feed_posts;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr 
    join pg_class c on pr.prrelid = c.oid 
    join pg_namespace n on c.relnamespace = n.oid 
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public' 
      and c.relname = 'love_feed_reactions'
  ) then
    alter publication supabase_realtime add table public.love_feed_reactions;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr 
    join pg_class c on pr.prrelid = c.oid 
    join pg_namespace n on c.relnamespace = n.oid 
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public' 
      and c.relname = 'love_feed_comments'
  ) then
    alter publication supabase_realtime add table public.love_feed_comments;
  end if;
end;
$$;
