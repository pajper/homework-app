-- Run this in Supabase SQL Editor to set up your database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null check (role in ('parent', 'child')),
  parent_id uuid references profiles(id) on delete cascade,
  avatar_color text default '#7F77DD',
  pin text, -- 4-digit PIN for child login
  created_at timestamptz default now()
);

-- Materials table (uploaded homework)
create table materials (
  id uuid default uuid_generate_v4() primary key,
  child_id uuid references profiles(id) on delete cascade not null,
  subject text not null,
  description text,
  content text, -- extracted text from PDF or direct input
  file_path text, -- path in Supabase Storage if PDF
  type text not null check (type in ('pdf', 'text')),
  due_date date,
  is_exam boolean default false,
  exam_date date,
  exam_subject text,
  week_number int,
  created_at timestamptz default now()
);

-- Exercises table (AI-generated exercises)
create table exercises (
  id uuid default uuid_generate_v4() primary key,
  material_id uuid references materials(id) on delete cascade not null,
  child_id uuid references profiles(id) on delete cascade not null,
  question text not null,
  type text not null check (type in ('multiple_choice', 'open', 'true_false')),
  options jsonb, -- for multiple choice: ["A", "B", "C", "D"]
  correct_answer text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  created_at timestamptz default now()
);

-- Answers table (child's answers to exercises)
create table answers (
  id uuid default uuid_generate_v4() primary key,
  exercise_id uuid references exercises(id) on delete cascade not null,
  child_id uuid references profiles(id) on delete cascade not null,
  answer text not null,
  is_correct boolean,
  answered_at timestamptz default now()
);

-- Storage bucket for PDFs
insert into storage.buckets (id, name, public) values ('materials', 'materials', false);

-- Row Level Security
alter table profiles enable row level security;
alter table materials enable row level security;
alter table exercises enable row level security;
alter table answers enable row level security;

-- Profiles: parents can see their own profile + their children
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Parents can view their children" on profiles for select using (
  auth.uid() = parent_id
);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Materials: parents can manage, children can view their own
create policy "Parents can manage materials" on materials for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'parent')
);
create policy "Children can view own materials" on materials for select using (
  child_id = auth.uid()
);

-- Exercises: children can view and answer their own
create policy "Children can view own exercises" on exercises for select using (
  child_id = auth.uid()
);
create policy "Parents can manage exercises" on exercises for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'parent')
);

-- Answers: children can insert and view own
create policy "Children can insert answers" on answers for insert with check (
  child_id = auth.uid()
);
create policy "Children can view own answers" on answers for select using (
  child_id = auth.uid()
);
create policy "Parents can view all answers" on answers for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'parent')
);

-- Storage policy
create policy "Parents can upload materials" on storage.objects for insert with check (
  bucket_id = 'materials' and
  exists (select 1 from profiles where id = auth.uid() and role = 'parent')
);
create policy "Authenticated can view materials" on storage.objects for select using (
  bucket_id = 'materials' and auth.role() = 'authenticated'
);
