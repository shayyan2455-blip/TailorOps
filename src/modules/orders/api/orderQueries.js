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

export async function fetchOrderForInvoice(orderId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, customers(*), order_items(*), measurements(*)')
    .eq('id', orderId)
    .single()
  if (error) throw error

  const { data: payments } = await supabase
    .from('payments')
    .select('amount, payment_date, payment_mode')
    .eq('order_id', orderId)
    .order('payment_date', { ascending: true })

  const paid = (payments || []).reduce((s, p) => s + Number(p.amount), 0)

  return { order, payments: payments || [], paid, balance: Number(order.total_amount) - paid }
}

export async function recordOrderPayment(tenantId, payload) {
  const { data, error } = await supabase.rpc('record_order_payment', {
    p_tenant_id: tenantId,
    p_order_id: payload.order_id,
    p_amount: payload.amount,
    p_payment_date: payload.payment_date,
    p_payment_mode: payload.payment_mode,
    p_notes: payload.notes || null,
  })
  if (error) throw error
  return data
}
