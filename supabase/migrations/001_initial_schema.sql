-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- 1. Create Profiles Table (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null check (role in ('admin', 'partner')),
  display_name text not null,
  avatar_url text,
  updated_at timestamptz default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- 2. Create Custom Helper Function for Role checking
create or replace function public.current_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer;

-- 3. Create Settings Table (Single row config)
create table public.settings (
  id int primary key check (id = 1),
  relationship_start_date date not null,
  theme_color text not null default '#D4537E',
  theme_mode_default text not null default 'light' check (theme_mode_default in ('light', 'dark')),
  partner_a_name text not null default 'Diệu Thiện',
  partner_a_avatar_url text,
  partner_b_name text not null default 'Quang Huy',
  partner_b_avatar_url text,
  cover_image_url text,
  next_special_date date,
  next_special_label text
);

-- Enable RLS on settings
alter table public.settings enable row level security;

-- 4. Create Letters Table
create table public.letters (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  tag text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  unlock_date date,
  cover_image_url text,
  created_at timestamptz default now() not null
);

-- Enable RLS on letters
alter table public.letters enable row level security;

-- 5. Create Timeline Events Table
create table public.timeline_events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  event_date date not null,
  is_special boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now() not null
);

-- Enable RLS on timeline_events
alter table public.timeline_events enable row level security;

-- 6. Create Timeline Images Table
create table public.timeline_images (
  id uuid default gen_random_uuid() primary key,
  timeline_event_id uuid references public.timeline_events(id) on delete cascade not null,
  image_url text not null,
  sort_order int not null default 0
);

-- Enable RLS on timeline_images
alter table public.timeline_images enable row level security;

-- 7. Create Love Map Locations Table
create table public.love_map_locations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  note text not null,
  image_url text,
  link text
);

-- Enable RLS on love_map_locations
alter table public.love_map_locations enable row level security;

-- 8. Create Guestbook Entries Table
create table public.guestbook_entries (
  id uuid default gen_random_uuid() primary key,
  author_role text not null check (author_role in ('admin', 'partner')),
  message text not null,
  created_at timestamptz default now() not null
);

-- Enable RLS on guestbook_entries
alter table public.guestbook_entries enable row level security;

-- 9. Create Quiz Questions Table
create table public.quiz_questions (
  id uuid default gen_random_uuid() primary key,
  question text not null,
  options jsonb not null, -- Array of choice strings
  correct_index int not null,
  unlock_reward_letter_id uuid references public.letters(id) on delete set null
);

-- Enable RLS on quiz_questions
alter table public.quiz_questions enable row level security;

-- =========================================================================
-- RLS POLICIES
-- =========================================================================

-- Profiles Policies
create policy "Users can view all profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Admins can manage profiles"
  on public.profiles for all
  to authenticated
  using (public.current_user_role() = 'admin');

-- Settings Policies
create policy "Users can view settings"
  on public.settings for select
  to authenticated
  using (true);

create policy "Admins can manage settings"
  on public.settings for all
  to authenticated
  using (public.current_user_role() = 'admin');

-- Letters Policies
create policy "Admins can do everything with letters"
  on public.letters for all
  to authenticated
  using (public.current_user_role() = 'admin');

create policy "Partners can view published letters"
  on public.letters for select
  to authenticated
  using (
    public.current_user_role() = 'partner' 
    and status = 'published'
  );

-- Create Secure Letters View to filter content for locked letters
create or replace view public.secure_letters as
  select 
    id, 
    title, 
    tag, 
    status, 
    unlock_date, 
    created_at,
    case 
      when (public.current_user_role() = 'admin' or unlock_date is null or unlock_date <= current_date) 
      then content 
      else 'Trực giác mách bảo đây là một bí mật... Hãy kiên nhẫn đợi đến ngày mở khóa nhé! 🔐' 
    end as content,
    case 
      when (public.current_user_role() = 'admin' or unlock_date is null or unlock_date <= current_date) 
      then cover_image_url 
      else null 
    end as cover_image_url
  from public.letters;


-- Timeline Events Policies
create policy "Users can view timeline events"
  on public.timeline_events for select
  to authenticated
  using (true);

create policy "Admins can manage timeline events"
  on public.timeline_events for all
  to authenticated
  using (public.current_user_role() = 'admin');

-- Timeline Images Policies
create policy "Users can view timeline images"
  on public.timeline_images for select
  to authenticated
  using (true);

create policy "Admins can manage timeline images"
  on public.timeline_images for all
  to authenticated
  using (public.current_user_role() = 'admin');

-- Love Map Locations Policies
create policy "Users can view love map locations"
  on public.love_map_locations for select
  to authenticated
  using (true);

create policy "Admins can manage love map locations"
  on public.love_map_locations for all
  to authenticated
  using (public.current_user_role() = 'admin');

-- Guestbook Entries Policies
create policy "Users can view guestbook entries"
  on public.guestbook_entries for select
  to authenticated
  using (true);

create policy "Users can insert guestbook entries"
  on public.guestbook_entries for insert
  to authenticated
  with check (
    author_role = public.current_user_role()
  );

create policy "Admins can manage guestbook entries"
  on public.guestbook_entries for all
  to authenticated
  using (public.current_user_role() = 'admin');

-- Quiz Questions Policies
create policy "Users can view quiz questions"
  on public.quiz_questions for select
  to authenticated
  using (true);

create policy "Admins can manage quiz questions"
  on public.quiz_questions for all
  to authenticated
  using (public.current_user_role() = 'admin');

-- =========================================================================
-- TRIGGERS & INITIAL DATA
-- =========================================================================

-- Trigger to automatically create profile on sign up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'partner'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seed settings row
insert into public.settings (
  id, 
  relationship_start_date, 
  theme_color, 
  theme_mode_default, 
  partner_a_name, 
  partner_b_name
)
values (
  1, 
  '2025-03-14', 
  '#D4537E', 
  'light', 
  'Diệu Thiện', 
  'Quang Huy'
)
on conflict (id) do nothing;

-- Seed profiles for the pre-created accounts (since trigger runs on signup, we seed them here for convenience)
insert into public.profiles (id, role, display_name)
values 
  ('6dce287a-8782-4b99-875c-6297ac633daa', 'admin', 'Quang Huy'),
  ('c4957d51-9148-4084-bf02-cb1063c12ddb', 'partner', 'Diệu Thiện')
on conflict (id) do nothing;

-- ==========================================
-- 4. GALERY MEDIA TABLE & STORAGE SETUP (PHASE 8d)
-- ==========================================
create table public.gallery_media (
  id uuid default gen_random_uuid() primary key,
  title text,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  thumbnail_url text,
  created_at timestamptz default now() not null
);

-- Enable RLS on gallery_media
alter table public.gallery_media enable row level security;

-- Policies for gallery_media
create policy "Users can view gallery media"
  on public.gallery_media for select
  to authenticated
  using (true);

create policy "Admins can manage gallery media"
  on public.gallery_media for all
  to authenticated
  using (public.current_user_role() = 'admin');

-- Insert gallery-media bucket into storage.buckets
insert into storage.buckets (id, name, public)
values ('gallery-media', 'gallery-media', true)
on conflict (id) do nothing;

-- Policies for gallery-media storage objects
create policy "Authenticated users can read gallery media objects"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'gallery-media');

create policy "Admins can manage gallery media objects"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'gallery-media' and public.current_user_role() = 'admin');


