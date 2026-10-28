create or replace function public.merkelapp_valid_body(b jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare l jsonb; e text; n integer; total integer; i integer;
begin
 if coalesce(jsonb_typeof(b),'')<>'object' or coalesce(jsonb_typeof(b->'lines'),'')<>'array' or jsonb_array_length(b->'lines')>500 then return false; end if;
 if coalesce(jsonb_typeof(b->'title'),'')<>'string' or length(b->>'title')>100 or coalesce(jsonb_typeof(b->'location'),'')<>'string' or length(b->>'location')>120 or coalesce(jsonb_typeof(b->'date'),'')<>'string' or (b->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
 perform (b->>'date')::date;
 if (select count(*) from jsonb_array_elements(b->'lines'))<>(select count(distinct value->>'ean') from jsonb_array_elements(b->'lines')) or (select count(*) from jsonb_array_elements(b->'lines'))<>(select count(distinct value->>'id') from jsonb_array_elements(b->'lines')) then return false; end if;
 for l in select value from jsonb_array_elements(b->'lines') loop
   if coalesce(jsonb_typeof(l->'id'),'')<>'string' or coalesce(jsonb_typeof(l->'name'),'')<>'string' or length(trim(l->>'name')) not between 1 and 500 or coalesce(jsonb_typeof(l->'ean'),'')<>'string' or coalesce(jsonb_typeof(l->'quantity'),'')<>'number' or (l->>'quantity') !~ '^\d+$' or (l->>'quantity')::numeric>9007199254740991 then return false; end if;
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
