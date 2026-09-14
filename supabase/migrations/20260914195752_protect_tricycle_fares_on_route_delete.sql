alter table public.tricycle_route_fares
  drop constraint tricycle_route_fares_route_id_fkey;
alter table public.tricycle_route_fares
  add constraint tricycle_route_fares_route_id_fkey
  foreign key (route_id)
  references public.routes(route_id)
  on update cascade
  on delete restrict;
