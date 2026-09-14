-- Tricycle fares vary by route/TODA. Keep the existing distance_fares table
-- limited to vehicle-wide matrices for jeep, bus, UV Express, and e-jeep.
alter table public.distance_fares
  drop constraint distance_fares_vehicle_type_check;
alter table public.distance_fares
  add constraint distance_fares_vehicle_type_check
  check (vehicle_type = any (array[3, 4, 5, 7]));

create function private.is_tricycle_route(p_route_id text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.routes r
    where r.route_id = p_route_id and r.route_type = 1
  )
$$;
revoke all on function private.is_tricycle_route(text) from public;
grant execute on function private.is_tricycle_route(text) to authenticated;

create table public.tricycle_route_fares (
  fare_id bigint generated always as identity primary key,
  route_id text not null
    references public.routes(route_id) on update cascade on delete cascade,
  fare_type text not null default 'STANDARD'
    check (fare_type in ('STANDARD', 'DISCOUNTED')),
  minimum_distance_meters integer not null,
  minimum_fare numeric not null,
  increment_distance_meters integer not null,
  increment_fare numeric not null,
  currency text not null default 'PHP' check (currency <> ''),
  constraint tricycle_route_fares_distance_check
    check (minimum_distance_meters >= 0 and increment_distance_meters > 0),
  constraint tricycle_route_fares_price_check
    check (minimum_fare >= 0 and increment_fare >= 0),
  constraint tricycle_route_fares_route_type_check
    check (private.is_tricycle_route(route_id)),
  constraint tricycle_route_fares_unique unique (route_id, fare_type)
);

comment on table public.tricycle_route_fares is
  'Distance-based fare matrices scoped to individual tricycle routes/TODAs.';

alter table public.tricycle_route_fares enable row level security;
revoke all on table public.tricycle_route_fares from anon, authenticated;
grant select on table public.tricycle_route_fares to anon, authenticated;
grant insert, update, delete on table public.tricycle_route_fares to authenticated;

create policy "Public tricycle fares read"
on public.tricycle_route_fares for select
to anon, authenticated
using (true);

create policy "Operations staff create tricycle fares"
on public.tricycle_route_fares for insert
to authenticated
with check ((select private.current_staff_role()) in ('admin', 'operator'));

create policy "Operations staff update tricycle fares"
on public.tricycle_route_fares for update
to authenticated
using ((select private.current_staff_role()) in ('admin', 'operator'))
with check ((select private.current_staff_role()) in ('admin', 'operator'));

create policy "Admins delete tricycle fares"
on public.tricycle_route_fares for delete
to authenticated
using ((select public.is_admin()));
