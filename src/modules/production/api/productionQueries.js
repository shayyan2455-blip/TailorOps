import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchProductionOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(name, mobile), order_items(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function transitionOrder(orderId, newStage) {
  const { data, error } = await supabase.rpc('transition_order_stage', {
    p_order_id: orderId,
    p_new_stage: newStage,
  })
  if (error) throw error
  return data
}
