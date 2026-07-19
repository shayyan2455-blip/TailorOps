import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchKpiData() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [
    { data: allOrders },
    { data: ordersToday },
    { data: ordersThisWeek },
    { data: ordersThisMonth },
    { data: stageCounts },
    { data: payments },
    { data: timeline },
    { data: topCust },
  ] = await Promise.all([
    supabase.from('orders').select('id, total_amount, current_stage, created_at, customer_id'),
    supabase.from('orders').select('id, total_amount').gte('created_at', todayStart),
    supabase.from('orders').select('id, total_amount').gte('created_at', weekStart),
    supabase.from('orders').select('id, total_amount').gte('created_at', monthStart),
    supabase.from('orders').select('current_stage').not('current_stage', 'is', null),
    supabase.from('payments').select('amount').gte('created_at', monthStart),
    supabase.from('orders').select('total_amount, created_at').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: true }),
    supabase.from('orders').select('customer_id, total_amount').not('customer_id', 'is', null),
  ])

  const totalOrders = allOrders?.length || 0
  const revToday = ordersToday?.reduce((s, o) => s + Number(o.total_amount || 0), 0) || 0
  const revWeek = ordersThisWeek?.reduce((s, o) => s + Number(o.total_amount || 0), 0) || 0
  const revMonth = ordersThisMonth?.reduce((s, o) => s + Number(o.total_amount || 0), 0) || 0
  const payMonth = payments?.reduce((s, p) => s + Number(p.amount || 0), 0) || 0

  const stages = {}
  stageCounts?.forEach(o => {
    const s = o.current_stage
    stages[s] = (stages[s] || 0) + 1
  })

  const customerIds = [...new Set(topCust?.map(o => o.customer_id).filter(Boolean))]
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .in('id', customerIds)

  const custMap = {}
  customers?.forEach(c => { custMap[c.id] = c.name })

  const custRevenue = {}
  topCust?.forEach(o => {
    if (!o.customer_id) return
    const name = custMap[o.customer_id] || 'Unknown'
    custRevenue[name] = (custRevenue[name] || 0) + Number(o.total_amount || 0)
  })
  const topCustomers = Object.entries(custRevenue)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const dailyMap = {}
  timeline?.forEach(o => {
    const day = o.created_at.slice(0, 10)
    dailyMap[day] = (dailyMap[day] || 0) + Number(o.total_amount || 0)
  })
  const timelineData = Object.entries(dailyMap)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { totalOrders, revToday, revWeek, revMonth, payMonth, stages, topCustomers, timelineData }
}

export async function fetchTailorWorkload() {
  const { data: tailors, error } = await supabase
    .from('tailors')
    .select('id, name, active')

  if (error) throw error

  const result = []
  for (const t of tailors) {
    const { data: assigned } = await supabase
      .from('order_assignments')
      .select('id, orders!inner(current_stage)')
      .eq('tailor_id', t.id)

    const delivered = assigned?.filter(a => a.orders?.current_stage === 'Delivered').length || 0
    const inProgress = assigned?.filter(a => a.orders?.current_stage !== 'Delivered').length || 0

    result.push({
      id: t.id,
      name: t.name,
      active: t.active,
      total: assigned?.length || 0,
      inProgress,
      delivered,
    })
  }
  return result
}
