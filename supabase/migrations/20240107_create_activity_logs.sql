-- Create activity_logs table
create table if not exists public.activity_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) not null,
    action_type text not null, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc.
    entity_type text not null, -- 'fiscalizacao', 'mensagem', 'gestor', 'usuario'
    entity_id text, -- ID of the affected record
    details jsonb, -- Flexible JSON for storing changed fields or other info
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.activity_logs enable row level security;

-- Policies
-- Admins can view all logs
create policy "Admins can view all activity logs"
on public.activity_logs
for select
to authenticated
using (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
);

-- Users can insert their own logs (usually handled by backend/triggers, but for client-side logging):
create policy "Users can insert their own activity logs"
on public.activity_logs
for insert
to authenticated
with check (
    auth.uid() = user_id
);

-- Users can view their own logs (optional, if valid)
create policy "Users can view their own activity logs"
on public.activity_logs
for select
to authenticated
using (
    auth.uid() = user_id
);
