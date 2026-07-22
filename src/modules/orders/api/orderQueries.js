import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchOrders({ stage, dateFrom, dateTo, search }) {
  let query = supabase
    .from('orders')
    .select('*, customers(name, mobile), order_items(*)')
    .order('created_at', { ascending: false })

  if (stage) query = query.eq('current_stage', stage)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)

  const { data, error } = await query
  if (error) throw error

  let results = data || []
  if (search) {
    const q = search.toLowerCase()
    results = results.filter(o =>
      o.order_number?.toLowerCase().includes(q) ||
      o.customers?.name?.toLowerCase().includes(q)
    )
  }
  return results
}

export async function fetchOrder(id) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(*), order_items(*), measurements(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createOrder(tenantId, payload) {
  const { data, error } = await supabase
    .from('orders')
    .insert({ ...payload, tenant_id: tenantId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateOrder(id, payload) {
  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteOrder(id) {
  const { error } = await supabase.from('orders').delete().eq('id', id)
  if (error) throw error
}
