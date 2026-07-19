import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchReadyOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(name, mobile), order_items(*)')
    .eq('current_stage', 'Ready')
    .order('ready_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchTodayDeliveries() {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(name, mobile), order_items(*)')
    .eq('current_stage', 'Delivered')
    .gte('delivered_at', today)
    .order('delivered_at', { ascending: false })
  if (error) throw error
  return data
}

export async function markDelivered(orderId) {
  const { data, error } = await supabase.rpc('transition_order_stage', {
    p_order_id: orderId,
    p_new_stage: 'Delivered',
  })
  if (error) throw error
  return data
}
