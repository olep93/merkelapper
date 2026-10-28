begin;
alter table public.merkelapp_sheets add column if not exists deleted_at timestamptz;
create index if not exists merkelapp_sheets_deleted on public.merkelapp_sheets(deleted_at) where deleted_at is not null;
alter policy merkelapp_owner_read on public.merkelapp_sheets to authenticated using(owner_id=auth.uid() and public.merkelapp_allowed() and (delete_after is null or delete_after>now()) and (deleted_at is null or deleted_at>now()-interval '7 days'));
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
commit;
