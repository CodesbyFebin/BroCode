-- Coding-Agent platform schema (our own design; Multica's agents-as-teammates
-- board inspired the task/run split, no schema or code was copied).
create table if not exists workspaces (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);
insert into workspaces (id, name) values ('default', 'Default workspace') on conflict do nothing;

create table if not exists workflows (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  name text not null,
  definition jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  title text not null,
  prompt text not null default '',
  assignee text not null default 'nemotron',
  workflow_id text references workflows(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_ws_status on tasks (workspace_id, status, created_at);

create table if not exists runs (
  id text primary key,
  task_id text not null references tasks(id) on delete cascade,
  status text not null check (status in ('running','ok','fail')),
  output text not null default '',
  model text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists skills (
  name text primary key,
  description text not null default '',
  body text not null,
  source text not null default 'bundled'
);

create table if not exists evals (
  id text primary key,
  suite text not null,
  score double precision not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);
