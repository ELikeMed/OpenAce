-- ═══════════════════════════════════════════════════════
-- OpenAce Cloud Schema — Supabase PostgreSQL
-- Run this in Supabase SQL Editor to set up the database
-- ═══════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ═══ Users & Businesses ═══

create table businesses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  industry text,
  mission text,
  target_audience text,
  offerings text,
  location text,
  website text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ai_config jsonb default '{}',
  tool_preferences jsonb default '{}',
  theme text default 'dark',
  autonomy_level text default 'collaborative',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══ Pipeline & CRM ═══

create table leads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  website text,
  stage text default 'new' check (stage in ('new', 'contacted', 'qualified', 'proposal', 'closed', 'lost')),
  source text,
  notes text,
  score integer,
  dnc boolean default false,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  company text,
  role text,
  notes text,
  tags text[] default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- ═══ Conversations ═══

create table conversations (
  id text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id, user_id)
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  sender text not null check (sender in ('user', 'ace', 'system')),
  content text,
  tools_used text[] default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- ═══ SOPs / Processes ═══

create table sops (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  triggers text[] default '{}',
  steps jsonb default '[]',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═══ Forms ═══

create table forms (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  slug text not null,
  title text not null,
  description text,
  fields jsonb default '[]',
  settings jsonb default '{}',
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table form_submissions (
  id uuid primary key default uuid_generate_v4(),
  form_id uuid references forms(id) on delete cascade not null,
  data jsonb not null,
  submitted_at timestamptz default now()
);

-- ═══ Memory & Knowledge ═══

create table notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  content text not null,
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table research_memory (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  query text not null,
  results jsonb not null,
  source text,
  created_at timestamptz default now()
);

-- ═══ Scheduled Tasks ═══

create table scheduled_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  schedule text not null,
  action jsonb not null,
  enabled boolean default true,
  last_run timestamptz,
  created_at timestamptz default now()
);

-- ═══ Credits & Billing ═══

create table credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text default 'trial' check (plan in ('trial', 'credits', 'subscription', 'byo_key')),
  total integer default 0,
  purchased integer default 0,
  subscription integer default 0,
  trial_start timestamptz default now(),
  stripe_customer_id text,
  stripe_subscription_id text,
  auto_reload boolean default false,
  auto_reload_amount integer default 10,
  updated_at timestamptz default now()
);

-- ═══ Row Level Security ═══
-- Every table is scoped to the authenticated user

alter table businesses enable row level security;
alter table user_settings enable row level security;
alter table leads enable row level security;
alter table contacts enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table sops enable row level security;
alter table forms enable row level security;
alter table form_submissions enable row level security;
alter table notes enable row level security;
alter table research_memory enable row level security;
alter table scheduled_tasks enable row level security;
alter table credits enable row level security;

-- RLS policies — users can only access their own data
create policy "users_own_businesses" on businesses for all using (auth.uid() = user_id);
create policy "users_own_settings" on user_settings for all using (auth.uid() = user_id);
create policy "users_own_leads" on leads for all using (auth.uid() = user_id);
create policy "users_own_contacts" on contacts for all using (auth.uid() = user_id);
create policy "users_own_conversations" on conversations for all using (auth.uid() = user_id);
create policy "users_own_messages" on messages for all using (auth.uid() = user_id);
create policy "users_own_sops" on sops for all using (auth.uid() = user_id);
create policy "users_own_forms" on forms for all using (auth.uid() = user_id);
create policy "public_form_submissions" on form_submissions for insert with check (true);
create policy "owners_read_submissions" on form_submissions for select using (
  exists (select 1 from forms where forms.id = form_submissions.form_id and forms.user_id = auth.uid())
);
create policy "users_own_notes" on notes for all using (auth.uid() = user_id);
create policy "users_own_research" on research_memory for all using (auth.uid() = user_id);
create policy "users_own_tasks" on scheduled_tasks for all using (auth.uid() = user_id);
create policy "users_own_credits" on credits for all using (auth.uid() = user_id);

-- ═══ Indexes ═══

create index idx_leads_user_stage on leads(user_id, stage);
create index idx_leads_user_business on leads(user_id, business_id);
create index idx_contacts_user on contacts(user_id);
create index idx_conversations_user on conversations(user_id);
create index idx_messages_conversation on messages(conversation_id, user_id);
create index idx_sops_user on sops(user_id);
create index idx_forms_user on forms(user_id);
create index idx_forms_slug on forms(slug);
create index idx_notes_user on notes(user_id);
