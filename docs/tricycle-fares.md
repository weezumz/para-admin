# Route-specific tricycle fares

Tricycle fares are stored separately from the vehicle-wide matrices used by
jeeps, buses, UV Express, and e-jeeps.

`public.tricycle_route_fares` stores one distance-based matrix per GTFS route
and fare type. The route is the franchise/TODA boundary currently used by the
PARA datasets. A `(route_id, fare_type)` unique constraint allows at most one
`STANDARD` and one `DISCOUNTED` matrix for each route.

Only GTFS routes with `route_type = 1` are accepted. A route with configured
fares cannot be deleted until an admin removes those fare records, preventing a
GTFS editor from bypassing the admin-only fare deletion rule. Passenger clients
may read the table; active admins and operators may create or update rows,
while deletion remains admin-only.

The sidebar's **Fare Management** menu links directly to three fare screens:

- **General fares** manages the shared vehicle matrices in `distance_fares`.
- **Tricycle fares** selects a route/TODA and manages its matrix in
  `tricycle_route_fares`.
- **Train fares** manages station-to-station rail fares.

The passenger app looks up a tricycle matrix using the journey leg's
`route_id` and the selected fare type. Cache keys include both values so fares
cannot leak between routes. A route without a configured matrix continues to
show an unavailable fare rather than falling back to another TODA's rates.

Migration `20260914195038_tricycle_route_fares.sql` is deployed to ParaV3.
Migration `20260914195752_protect_tricycle_fares_on_route_delete.sql` tightens
the route foreign key after deployment.
`supabase/tests/tricycle_route_fares_rls_test.sql` exercises route validation,
uniqueness, public reads, operator writes, editor denial, and admin deletion in
a rollback-only transaction.
