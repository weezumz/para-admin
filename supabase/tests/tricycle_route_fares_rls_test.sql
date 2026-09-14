begin;
-- Run against a linked test/staging database. All writes are rolled back.
do $test$
declare
  actor uuid;
  tricycle_route text;
  non_tricycle_route text;
  test_fare bigint;
  n integer;
begin
  select user_id into actor
  from public.admin_users
  where role = 'admin' and is_active
  order by user_id
  limit 1;
  select route_id into tricycle_route
  from public.routes
  where route_type = 1
  order by route_id
  limit 1;
  select route_id into non_tricycle_route
  from public.routes
  where route_type <> 1
  order by route_id
  limit 1;
  if actor is null or tricycle_route is null or non_tricycle_route is null then
    raise exception 'Tests require an active admin plus tricycle and non-tricycle routes';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  insert into public.tricycle_route_fares(
    route_id, fare_type, minimum_distance_meters, minimum_fare,
    increment_distance_meters, increment_fare, currency
  ) values (tricycle_route, 'STANDARD', 1000, 15, 500, 2, 'PHP')
  returning fare_id into test_fare;
  begin
    insert into public.tricycle_route_fares(
      route_id, fare_type, minimum_distance_meters, minimum_fare,
      increment_distance_meters, increment_fare, currency
    ) values (tricycle_route, 'STANDARD', 1000, 20, 500, 3, 'PHP');
    raise exception 'Duplicate route and fare type was allowed';
  exception when unique_violation then null;
  end;
  begin
    insert into public.tricycle_route_fares(
      route_id, fare_type, minimum_distance_meters, minimum_fare,
      increment_distance_meters, increment_fare, currency
    ) values (non_tricycle_route, 'STANDARD', 1000, 20, 500, 3, 'PHP');
    raise exception 'A non-tricycle route was accepted';
  exception when check_violation then null;
  end;
  execute 'reset role';

  update public.admin_users set role = 'operator' where user_id = actor;
  execute 'set local role authenticated';
  update public.tricycle_route_fares set minimum_fare = 16 where fare_id = test_fare;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Operator could not update a tricycle fare'; end if;
  insert into public.tricycle_route_fares(
    route_id, fare_type, minimum_distance_meters, minimum_fare,
    increment_distance_meters, increment_fare, currency
  ) values (tricycle_route, 'DISCOUNTED', 1000, 12.80, 500, 1.60, 'PHP');
  delete from public.tricycle_route_fares where fare_id = test_fare;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Operator was allowed to delete a tricycle fare'; end if;
  execute 'reset role';
  delete from public.tricycle_route_fares
  where route_id = tricycle_route and fare_type = 'DISCOUNTED';

  update public.admin_users set role = 'editor' where user_id = actor;
  execute 'set local role authenticated';
  update public.tricycle_route_fares set minimum_fare = 17 where fare_id = test_fare;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Editor was allowed to update a tricycle fare'; end if;
  begin
    insert into public.tricycle_route_fares(
      route_id, fare_type, minimum_distance_meters, minimum_fare,
      increment_distance_meters, increment_fare, currency
    ) values (tricycle_route, 'DISCOUNTED', 1000, 17, 500, 2, 'PHP');
    raise exception 'Editor was allowed to create a tricycle fare';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.routes where route_id = tricycle_route;
    raise exception 'Editor deleted a route with protected fare records';
  exception when foreign_key_violation then null;
  end;
  execute 'reset role';

  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  perform 1 from public.tricycle_route_fares where fare_id = test_fare;
  begin
    insert into public.tricycle_route_fares(
      route_id, fare_type, minimum_distance_meters, minimum_fare,
      increment_distance_meters, increment_fare, currency
    ) values (tricycle_route, 'STANDARD', 1000, 17, 500, 2, 'PHP');
    raise exception 'Anonymous fare creation was allowed';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  update public.admin_users set role = 'admin' where user_id = actor;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  delete from public.tricycle_route_fares where route_id = tricycle_route;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Admin could not delete tricycle fares'; end if;
  execute 'reset role';
end $test$;
rollback;
