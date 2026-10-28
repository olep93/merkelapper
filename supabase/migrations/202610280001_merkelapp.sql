begin;
create or replace function public.merkelapp_valid_body(b jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare l jsonb; e text; n integer; total integer; i integer;
begin
 if jsonb_typeof(b)<>'object' or jsonb_typeof(b->'lines')<>'array' or jsonb_array_length(b->'lines')>500 then return false; end if;
 if jsonb_typeof(b->'title')<>'string' or length(b->>'title')>100 or jsonb_typeof(b->'location')<>'string' or length(b->>'location')>120 or (b->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
 perform (b->>'date')::date;
 for l in select value from jsonb_array_elements(b->'lines') loop
   if coalesce(jsonb_typeof(l->'name'),'')<>'string' or length(trim(l->>'name')) not between 1 and 500 or coalesce(jsonb_typeof(l->'ean'),'')<>'string' or coalesce(jsonb_typeof(l->'quantity'),'')<>'number' or (l->>'quantity') !~ '^\d+$' or (l->>'quantity')::numeric>9007199254740991 then return false; end if;
   perform (l->>'id')::uuid;
   e:=l->>'ean'; n:=length(e); total:=0;
   if e !~ '^(\d{8}|\d{13})$' then return false; end if;
   for i in 1..n-1 loop total:=total+substring(e from n-i for 1)::integer*(case when i%2=1 then 3 else 1 end); end loop;
   if (10-total%10)%10<>right(e,1)::integer then return false; end if;
 end loop;
 return true;
exception when others then return false;
end;
$$;
create table if not exists public.merkelapp_sheets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 body jsonb not null, state text not null default 'draft' check(state in ('draft','locked')),
 version integer not null default 1, revision integer not null default 0, last_operation_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 printed_at timestamptz, delete_after timestamptz
);
create index if not exists merkelapp_sheets_owner on public.merkelapp_sheets(owner_id,updated_at desc);
create index if not exists merkelapp_sheets_expiry on public.merkelapp_sheets(delete_after) where delete_after is not null;
create table if not exists public.merkelapp_revisions (
 sheet_id uuid not null references public.merkelapp_sheets(id) on delete cascade,
 revision integer not null, body jsonb not null, template_version integer not null default 1,
 locked_at timestamptz not null default now(), primary key(sheet_id,revision)
);
alter table public.merkelapp_sheets enable row level security;
alter table public.merkelapp_revisions enable row level security;
create or replace function public.merkelapp_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=auth.uid() and (u.banned_until is null or u.banned_until<now()) and coalesce(u.raw_app_meta_data->'apps','[]'::jsonb) ? 'merkelapp');
$$;
revoke all on function public.merkelapp_allowed() from public;
grant execute on function public.merkelapp_allowed() to authenticated;
create policy merkelapp_owner_read on public.merkelapp_sheets for select to authenticated using(owner_id=auth.uid() and public.merkelapp_allowed() and (delete_after is null or delete_after>now()));
create policy merkelapp_revision_read on public.merkelapp_revisions for select to authenticated using(exists(select 1 from public.merkelapp_sheets s where s.id=sheet_id));
grant select on public.merkelapp_sheets,public.merkelapp_revisions to authenticated;
revoke insert,update,delete on public.merkelapp_sheets,public.merkelapp_revisions from anon,authenticated;
-- Only this checked function writes. Clients cannot edit a locked sheet directly.
create or replace function public.merkelapp_write(p_id uuid,p_version integer,p_operation uuid,p_action text,p_body jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.merkelapp_sheets; uid uuid:=auth.uid();
begin
 if uid is null or not public.merkelapp_allowed() then raise exception 'access_denied'; end if;
 if p_action in ('create','save') and not public.merkelapp_valid_body(p_body) then raise exception 'invalid_body'; end if;
 if p_action='create' then
   insert into public.merkelapp_sheets(id,owner_id,body,last_operation_id) values(p_id,uid,p_body,p_operation) on conflict(id) do nothing;
 end if;
 select * into s from public.merkelapp_sheets where id=p_id and owner_id=uid for update;
 if not found or (s.delete_after is not null and s.delete_after<=now()) then raise exception 'not_found'; end if;
 if s.last_operation_id=p_operation then return to_jsonb(s); end if;
 if p_action='create' or s.version<>p_version then raise exception 'version_conflict'; end if;
 if p_action='save' then
   if s.state<>'draft' then raise exception 'sheet_locked'; end if;
   update public.merkelapp_sheets set body=p_body where id=p_id;
 elsif p_action='lock' then
   if s.state<>'draft' or jsonb_array_length(s.body->'lines')=0 then raise exception 'cannot_lock'; end if;
   insert into public.merkelapp_revisions(sheet_id,revision,body) values(p_id,s.revision+1,s.body);
   update public.merkelapp_sheets set state='locked',revision=s.revision+1 where id=p_id;
 elsif p_action='reopen' then
   if s.state<>'locked' then raise exception 'not_locked'; end if;
   update public.merkelapp_sheets set state='draft',printed_at=null,delete_after=null where id=p_id;
 elsif p_action='printed' then
   if s.state<>'locked' then raise exception 'not_locked'; end if;
   -- Repeated marking does not extend the retention period.
   update public.merkelapp_sheets set printed_at=coalesce(printed_at,now()),delete_after=coalesce(delete_after,now()+interval '7 days') where id=p_id;
 elsif p_action='delete' then
   delete from public.merkelapp_sheets where id=p_id; return jsonb_build_object('deleted',true);
 else raise exception 'invalid_action';
 end if;
 update public.merkelapp_sheets set version=version+1,last_operation_id=p_operation,updated_at=now() where id=p_id returning * into s;
 return to_jsonb(s);
end;
$$;
revoke all on function public.merkelapp_write(uuid,integer,uuid,text,jsonb) from public;
grant execute on function public.merkelapp_write(uuid,integer,uuid,text,jsonb) to authenticated;
commit;
