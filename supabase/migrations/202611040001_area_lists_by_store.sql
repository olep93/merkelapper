-- Area and merged lists are shared per store. Everyone with Merkelapp access in the store can read
-- them, while only the owner can change them. Ordinary sheets stay private (store_id is null).
-- Stores and memberships belong to Driftssjekk in the same Supabase project. Its access helpers also
-- require the driftssjekk app, so Merkelapp reads the membership rows directly.
begin;
alter table public.merkelapp_sheets
  add column if not exists store_id uuid references public.stores(id) on delete set null,
  add column if not exists owner_name text;
create index if not exists merkelapp_sheets_store on public.merkelapp_sheets(store_id,updated_at desc) where store_id is not null;

create or replace function public.merkelapp_user_stores(p_user uuid) returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
 select s.id,s.name from public.stores s
 where s.active and exists(
   select 1 from public.memberships m
   where m.user_id=p_user and m.cooperative_id=s.cooperative_id
     and (m.store_id=s.id or (m.store_id is null and m.role in ('operations','cooperative_admin')))
 );
$$;
revoke all on function public.merkelapp_user_stores(uuid) from public,anon,authenticated;

create or replace function public.merkelapp_my_stores() returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
 select u.id,u.name from public.merkelapp_user_stores(auth.uid()) u where public.merkelapp_allowed() order by u.name;
$$;
revoke all on function public.merkelapp_my_stores() from public,anon;
grant execute on function public.merkelapp_my_stores() to authenticated;

-- The name comes from the account, never from the client.
create or replace function public.merkelapp_owner_name(p_user uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce(
   nullif(trim(u.raw_user_meta_data->>'display_name'),''),
   nullif(trim(u.raw_user_meta_data->>'full_name'),''),
   nullif(trim(u.raw_user_meta_data->>'name'),''),
   nullif(regexp_replace(split_part(coalesce(u.email,''),'@',1),'[._]+',' ','g'),'')
 ) from auth.users u where u.id=p_user;
$$;
revoke all on function public.merkelapp_owner_name(uuid) from public,anon,authenticated;

update public.merkelapp_sheets set owner_name=public.merkelapp_owner_name(owner_id) where owner_name is null;
-- Existing lists are shared only when the owner belongs to exactly one store. Otherwise we cannot
-- know which store a list was counted in, so it stays private.
update public.merkelapp_sheets t set store_id=(select u.id from public.merkelapp_user_stores(t.owner_id) u)
 where t.store_id is null and t.body->>'kind' in ('area','merged')
   and (select count(*) from public.merkelapp_user_stores(t.owner_id))=1;

alter policy merkelapp_owner_read on public.merkelapp_sheets to authenticated using(
 public.merkelapp_allowed() and (delete_after is null or delete_after>now()) and (
   (owner_id=auth.uid() and (deleted_at is null or deleted_at>now()-interval '7 days'))
   -- A colleague's list disappears as soon as it is moved to the trash.
   or (deleted_at is null and store_id in (select id from public.merkelapp_my_stores()))
 ));

drop function if exists public.merkelapp_write(uuid,integer,uuid,text,jsonb);
create or replace function public.merkelapp_write(p_id uuid,p_version integer,p_operation uuid,p_action text,p_body jsonb default null,p_store uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.merkelapp_sheets; uid uuid:=auth.uid();
begin
 if uid is null or not public.merkelapp_allowed() then raise exception 'access_denied'; end if;
 if p_action in ('create','save') and not public.merkelapp_valid_body(p_body) then raise exception 'invalid_body'; end if;
 if p_action='create' then
   if p_store is not null and (coalesce(p_body->>'kind','') not in ('area','merged') or not exists(select 1 from public.merkelapp_my_stores() m where m.id=p_store)) then raise exception 'store_denied'; end if;
   insert into public.merkelapp_sheets(id,owner_id,body,last_operation_id,store_id,owner_name) values(p_id,uid,p_body,p_operation,p_store,public.merkelapp_owner_name(uid)) on conflict(id) do nothing;
 end if;
 -- Colleagues can read a shared list, but every write stays limited to the owner.
 select * into s from public.merkelapp_sheets where id=p_id and owner_id=uid for update;
 if not found or (s.delete_after is not null and s.delete_after<=now()) or (s.deleted_at is not null and s.deleted_at<=now()-interval '7 days') then raise exception 'not_found'; end if;
 if s.last_operation_id=p_operation then return to_jsonb(s); end if;
 if p_action='create' or s.version<>p_version then raise exception 'version_conflict'; end if;
 if s.deleted_at is not null and p_action not in ('restore','delete') then raise exception 'sheet_deleted'; end if;
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
   update public.merkelapp_sheets set deleted_at=coalesce(deleted_at,now()) where id=p_id;
 elsif p_action='restore' then
   if s.deleted_at is null then raise exception 'not_deleted'; end if;
   update public.merkelapp_sheets set deleted_at=null where id=p_id;
 else raise exception 'invalid_action';
 end if;
 update public.merkelapp_sheets set version=version+1,last_operation_id=p_operation,updated_at=now() where id=p_id returning * into s;
 return to_jsonb(s);
end;
$$;
revoke all on function public.merkelapp_write(uuid,integer,uuid,text,jsonb,uuid) from public,anon;
grant execute on function public.merkelapp_write(uuid,integer,uuid,text,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
