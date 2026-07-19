import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchTailors(search) {
  let query = supabase.from('tailors').select('*').order('created_at', { ascending: false })
  if (search) query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchTailor(id) {
  const { data, error } = await supabase.from('tailors').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createTailor(tenantId, payload) {
  const { data, error } = await supabase.from('tailors').insert({ ...payload, tenant_id: tenantId }).select().single()
  if (error) throw error
  return data
}

export async function updateTailor(id, payload) {
  const { data, error } = await supabase.from('tailors').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTailor(id) {
  const { error } = await supabase.from('tailors').delete().eq('id', id)
  if (error) throw error
}

export async function fetchWorkAssignments(tailorId) {
  let query = supabase
    .from('work_assignments')
    .select('*, orders(order_number, current_stage, customers(name))')
    .order('assigned_at', { ascending: false })
  if (tailorId) query = query.eq('tailor_id', tailorId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function assignTailor(tenantId, orderId, tailorId, stage) {
  const { data, error } = await supabase
    .from('work_assignments')
    .upsert({ tenant_id: tenantId, order_id: orderId, tailor_id: tailorId, stage }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function removeAssignment(id) {
  const { error } = await supabase.from('work_assignments').delete().eq('id', id)
  if (error) throw error
}
