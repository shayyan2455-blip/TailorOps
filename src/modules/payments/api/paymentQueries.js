import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchPayments({ orderId } = {}) {
  let query = supabase
    .from('payments')
    .select('*, orders(order_number, total_amount, customers(name))')
    .order('created_at', { ascending: false })
  if (orderId) query = query.eq('order_id', orderId)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchBalance(orderId) {
  const { data, error } = await supabase.rpc('get_order_balance', { p_order_id: orderId })
  if (error) throw error
  return data?.[0] || { total_amount: 0, total_paid: 0, balance: 0 }
}

export async function createPayment(tenantId, payload) {
  const { data, error } = await supabase
    .from('payments')
    .insert({ ...payload, tenant_id: tenantId })
    .select('*, orders(order_number)')
    .single()
  if (error) throw error
  return data
}

export async function deletePayment(id) {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
}
