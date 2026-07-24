import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchProfitSummary(tenantId, start, end) {
  const { data, error } = await supabase.rpc('get_shop_profit_summary', {
    p_tenant_id: tenantId,
    p_start: start,
    p_end: end,
  })
  if (error) throw error
  return data
}

export async function fetchRevenueMetrics(tenantId, start, end) {
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('tenant_id', tenantId)
    .gte('created_at', start)
    .lte('created_at', end)

  if (oErr) throw oErr

  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select('amount')
    .eq('tenant_id', tenantId)
    .gte('payment_date', start)
    .lte('payment_date', end)

  if (pErr) throw pErr

  const totalRevenue = orders?.reduce((s, o) => s + Number(o.total_amount), 0) || 0
  const totalCollected = payments?.reduce((s, p) => s + Number(p.amount), 0) || 0
  const outstanding = totalRevenue - totalCollected
  const orderCount = orders?.length || 0
  const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0

  return { totalRevenue, totalCollected, outstanding, avgOrderValue, orderCount }
}

export async function fetchOrdersByStage(tenantId, start, end) {
  const { data, error } = await supabase
    .from('orders')
    .select('current_stage')
    .eq('tenant_id', tenantId)
    .gte('created_at', start)
    .lte('created_at', end)
    .not('current_stage', 'is', null)

  if (error) throw error

  const stages = {}
  data?.forEach(o => {
    const s = o.current_stage
    stages[s] = (stages[s] || 0) + 1
  })

  return stages
}

export async function fetchExpensesBreakdown(tenantId, start, end) {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      payee_name,
      amount,
      expense_payments!inner(amount, payment_date)
    `)
    .eq('tenant_id', tenantId)
    .gte('expense_payments.payment_date', start)
    .lte('expense_payments.payment_date', end)

  if (error) throw error

  const payeeMap = {}
  data?.forEach(exp => {
    const payee = exp.payee_name || 'Unknown'
    if (!payeeMap[payee]) payeeMap[payee] = { payee, total: 0, paid: 0 }
    payeeMap[payee].total += Number(exp.amount)
    exp.expense_payments?.forEach(ep => {
      payeeMap[payee].paid += Number(ep.amount)
    })
  })

  return Object.values(payeeMap).sort((a, b) => b.paid - a.paid)
}

export async function fetchTailorPerformance(tenantId) {
  const { data, error } = await supabase.rpc('get_tailor_ledgers', {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data || []
}

export async function fetchOrderRevenueDetail(tenantId, start, end) {
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select(`
      id, order_number, total_amount, created_at, delivery_date,
      customers(name),
      current_stage
    `)
    .eq('tenant_id', tenantId)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false })
    .limit(500)

  if (oErr) throw oErr

  const orderIds = orders?.map(o => o.id) || []
  if (orderIds.length === 0) return []

  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select('order_id, amount')
    .in('order_id', orderIds)

  if (pErr) throw pErr

  const payByOrder = {}
  payments?.forEach(p => {
    if (!p.order_id) return
    payByOrder[p.order_id] = (payByOrder[p.order_id] || 0) + Number(p.amount)
  })

  return (orders || []).map(o => ({
    id: o.id,
    order_number: o.order_number,
    customer_name: o.customers?.name || '—',
    total_amount: Number(o.total_amount),
    total_paid: payByOrder[o.id] || 0,
    balance: Number(o.total_amount) - (payByOrder[o.id] || 0),
    delivery_date: o.delivery_date,
    current_stage: o.current_stage,
  }))
}
