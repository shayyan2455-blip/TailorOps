import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchProductionOrders() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(name, mobile), order_items(*), work_assignments(*, tailors(name))')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).filter(o =>
    o.current_stage !== 'Delivered' || (o.delivered_at && o.delivered_at >= cutoff)
  )
}

export async function transitionOrder(orderId, newStage) {
  const { data, error } = await supabase.rpc('transition_order_stage', {
    p_order_id: orderId,
    p_new_stage: newStage,
  })
  if (error) throw error
  return data
}

export async function assignTailorToOrder(tenantId, orderId, tailorId, stage) {
  const { data, error } = await supabase
    .from('work_assignments')
    .insert({ tenant_id: tenantId, order_id: orderId, tailor_id: tailorId, stage })
    .select('*, tailors(name)')
    .single()
  if (error) throw error
  return data
}

export async function unassignTailor(assignmentId) {
  const { error } = await supabase.from('work_assignments').delete().eq('id', assignmentId)
  if (error) throw error
}

export async function setWorkAssignmentAmount(orderId, stage, amount) {
  const { data, error } = await supabase
    .from('work_assignments')
    .update({ amount })
    .eq('order_id', orderId)
    .eq('stage', stage)
    .select()
    .single()
  if (error) throw error
  return data
}
