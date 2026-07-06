-- 1. Alter Settings table to add music columns
alter table public.settings 
  add column if not exists music_url text,
  add column if not exists music_title text default 'Bài hát kỷ niệm';

-- 2. Create Bucket List Table
create table if not exists public.bucket_list (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'planning', 'completed')),
  completed_at date,
  linked_event_id uuid references public.timeline_events(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Enable RLS for bucket_list
alter table public.bucket_list enable row level security;
create policy "Authenticated users can manage bucket list" 
  on public.bucket_list for all 
  to authenticated 
  using (true);

-- 3. Create Mood Tracker Table
create table if not exists public.mood_tracker (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  mood_emoji text not null,
  mood_note text,
  check_in_date date default current_date not null,
  created_at timestamptz default now() not null,
  unique(profile_id, check_in_date)
);

-- Enable RLS for mood_tracker
alter table public.mood_tracker enable row level security;
create policy "Authenticated users can view mood trackers" 
  on public.mood_tracker for select 
  to authenticated 
  using (true);

create policy "Authenticated users can manage mood trackers" 
  on public.mood_tracker for all 
  to authenticated 
  using (auth.uid() = profile_id);

-- 4. Create Love Quotes Table
create table if not exists public.love_quotes (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Enable RLS for love_quotes
alter table public.love_quotes enable row level security;
create policy "Authenticated users can view love quotes" 
  on public.love_quotes for select 
  to authenticated 
  using (true);

create policy "Authenticated users can manage love quotes" 
  on public.love_quotes for all 
  to authenticated 
  using (true);

-- 5. Create Love Challenges Table
create table if not exists public.love_challenges (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null,
  partner_a_completed boolean not null default false,
  partner_b_completed boolean not null default false,
  reward_text text,
  reward_image_url text,
  created_at timestamptz default now() not null
);

-- Enable RLS for love_challenges
alter table public.love_challenges enable row level security;
create policy "Authenticated users can manage love challenges" 
  on public.love_challenges for all 
  to authenticated 
  using (true);

-- Seed love quotes
insert into public.love_quotes (content) values
  ('Hôm nay anh nhớ em nhiều hơn hôm qua và ít hơn ngày mai. ❤️'),
  ('Cảm ơn em vì đã là một phần tuyệt vời nhất trong cuộc đời anh. 🌸'),
  ('Yêu không chỉ là nhìn nhau, mà là cùng nhau nhìn về một hướng. 🌅'),
  ('Nụ cười của em chính là động lực lớn nhất của anh mỗi ngày. 🥰'),
  ('Cùng em đi qua bão giông, cùng em ngắm ánh bình minh. ☀️'),
  ('Mỗi ngày bên em đều là một ngày đặc biệt. 🎁'),
  ('Tình yêu của chúng mình giống như một câu chuyện cổ tích đẹp nhất. 📖')
on conflict do nothing;

-- Seed love challenges
insert into public.love_challenges (title, description, reward_text) values
  ('Chụp ảnh đôi ngộ nghĩnh', 'Cùng chụp một bức ảnh với biểu cảm ngộ nghĩnh nhất của hai bạn và lưu vào album.', 'Chúc mừng hai bạn! Một phần quà bất ngờ từ anh ấy: "Anh hứa sẽ nấu món em thích vào cuối tuần này!" 🍳'),
  ('Lời gửi thoại yêu thương', 'Gửi cho đối phương một tin nhắn thoại nói về điều bạn thích nhất ở họ.', 'Bạn đã nghe thấy giọng nói ấm áp đó chưa? Hãy dành cho nhau cái ôm thật chặt nhé! 🤗'),
  ('Khám phá địa điểm mới', 'Cùng nhau ghé thăm một quán cà phê hoặc địa điểm mà cả hai chưa từng đến bao giờ.', 'Kỷ niệm mới đã được ghi lại trên Bản đồ tình yêu! 🗺️')
on conflict do nothing;
