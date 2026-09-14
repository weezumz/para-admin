import { DISTANCE_FARE_VEHICLE_TYPES } from '../../constants/vehicleTypes'
import { supabase } from '../../lib/supabase'
import { deleteRecord } from '../../lib/crud'

export const deleteFare = (id) => deleteRecord(supabase, 'distance_fares', 'fare_id', id)
export const deleteTricycleFare = (id) =>
  deleteRecord(supabase, 'tricycle_route_fares', 'fare_id', id)

export const VEHICLE_TYPES = DISTANCE_FARE_VEHICLE_TYPES
export const FARE_TYPES = ['STANDARD', 'DISCOUNTED']

export async function getFareMatrix() {
  const { data, error } = await supabase
    .from('distance_fares')
    .select('*')
    .order('vehicle_type')
    .order('fare_type')
  return { fares: data ?? [], error }
}

export async function createFare(fare) {
  const { data, error } = await supabase.from('distance_fares').insert(fare).select().single()
  return { fare: data, error }
}

export async function updateFare(fareId, fare) {
  const { data, error } = await supabase
    .from('distance_fares')
    .update(fare)
    .eq('fare_id', fareId)
    .select()
    .single()
  return { fare: data, error }
}

export async function getTricycleFareMatrix() {
  const { data, error } = await supabase
    .from('tricycle_route_fares')
    .select('*')
    .order('route_id')
    .order('fare_type')
  return { fares: data ?? [], error }
}

export async function getTricycleRoutes() {
  const { data, error } = await supabase
    .from('routes')
    .select('route_id, route_long_name')
    .eq('route_type', 1)
    .order('route_long_name')
  return { routes: data ?? [], error }
}

export async function createTricycleFare(fare) {
  const { data, error } = await supabase.from('tricycle_route_fares').insert(fare).select().single()
  return { fare: data, error }
}

export async function updateTricycleFare(fareId, fare) {
  const { data, error } = await supabase
    .from('tricycle_route_fares')
    .update(fare)
    .eq('fare_id', fareId)
    .select()
    .single()
  return { fare: data, error }
}
