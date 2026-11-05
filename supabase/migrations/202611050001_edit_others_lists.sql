-- Lets one chosen account correct colleagues' shared lists. The flag lives in app_metadata, which
-- only the server can set. Private sheets, printed marking and deletion stay with the owner.
begin;
create or replace function public.merkelapp_can_edit_others(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select u.raw_app_meta_data->>'merkelapp_editor'='true' from auth.users u where u.id=p_user),false);
$$;
revoke all on function public.merkelapp_can_edit_others(uuid) from public,anon,authenticated;

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
 -- Colleagues can read a shared list, but writes stay limited to the owner. An account with the
 -- server-controlled merkelapp_editor flag can also edit, lock and reopen lists in its own stores.
 select * into s from public.merkelapp_sheets where id=p_id and (
   owner_id=uid or (
     p_action in ('save','lock','reopen') and store_id in (select id from public.merkelapp_my_stores())
     and public.merkelapp_can_edit_others(uid)
   )) for update;
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
