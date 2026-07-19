import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select('*, orders!inner(order_number, total_amount, customers!inner(name))')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchCustomersForPayment(tenantId) {
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name, mobile')
    .order('name')
  if (error) throw error

  const result = []
  for (const c of customers) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_amount, current_stage')
      .eq('customer_id', c.id)

    let totalUnpaid = 0
    for (const o of orders || []) {
      const { data: payData } = await supabase
        .from('payments')
        .select('amount')
        .eq('order_id', o.id)
      const paid = (payData || []).reduce((s, p) => s + Number(p.amount), 0)
      totalUnpaid += Number(o.total_amount) - paid
    }

    result.push({ ...c, unpaid: Math.max(0, totalUnpaid) })
  }
  return result.sort((a, b) => b.unpaid - a.unpaid)
}

export async function distributePayment(tenantId, payload) {
  const { data, error } = await supabase.rpc('distribute_customer_payment', {
    p_customer_id: payload.customer_id,
    p_amount: payload.amount,
    p_payment_date: payload.payment_date,
    p_payment_mode: payload.payment_mode,
    p_notes: payload.notes || null,
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data
}

export async function deletePayment(id) {
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) throw error
}

export async function fetchCustomerWithOrders(customerId) {
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, current_stage, created_at')
    .eq('customer_id', customerId)
    .neq('current_stage', 'Delivered')
    .order('created_at', { ascending: true })

  const ordersWithBalance = []
  for (const o of orders || []) {
    const { data: payData } = await supabase
      .from('payments')
      .select('amount')
      .eq('order_id', o.id)
    const paid = (payData || []).reduce((s, p) => s + Number(p.amount), 0)
    ordersWithBalance.push({ ...o, paid, balance: Number(o.total_amount) - paid })
  }

  return { customer, orders: ordersWithBalance }
}
