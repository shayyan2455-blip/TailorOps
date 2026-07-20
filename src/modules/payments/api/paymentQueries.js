import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select('*, customers(name), orders(order_number, total_amount, customer_id, customers(name))')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchCustomersForPayment(tenantId) {
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name, mobile, credit')
    .order('name')
  if (error) throw error

  const result = []
  for (const c of customers) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_amount, current_stage')
      .eq('customer_id', c.id)

    let totalOrders = 0
    let totalPaid = 0
    for (const o of orders || []) {
      totalOrders += Number(o.total_amount)
      const { data: payData } = await supabase
        .from('payments')
        .select('amount')
        .eq('order_id', o.id)
      const paid = (payData || []).reduce((s, p) => s + Number(p.amount), 0)
      totalPaid += paid
    }

    const credit = Number(c.credit || 0)
    const balance = totalOrders - totalPaid - credit
    const unpaid = Math.max(0, balance)
    result.push({ ...c, total_orders: totalOrders, total_paid: totalPaid, balance, unpaid, credit })
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

export async function fetchPaymentForReceipt(paymentId) {
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*, customers(name, mobile, address), orders(order_number, total_amount)')
    .eq('id', paymentId)
    .single()
  if (error) throw error

  let balance = 0
  if (payment.orders) {
    const { data: orderPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('order_id', payment.order_id)
    const paid = (orderPayments || []).reduce((s, p) => s + Number(p.amount), 0)
    balance = Math.max(0, Number(payment.orders.total_amount) - paid)
  }

  return { payment, balance }
}
