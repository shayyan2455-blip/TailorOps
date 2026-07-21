import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchDashboardMetrics(tenantId) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('id, total_amount, current_stage')
    .eq('tenant_id', tenantId)
    .gte('created_at', monthStart)

  if (oErr) throw oErr

  const { data: payments, error: pErr } = await supabase
    .from('payments')
    .select('amount')
    .eq('tenant_id', tenantId)
    .gte('created_at', monthStart)

  if (pErr) throw pErr

  const totalOrders = orders?.length || 0
  const revMonth = orders?.reduce((s, o) => s + Number(o.total_amount || 0), 0) || 0
  const payMonth = payments?.reduce((s, p) => s + Number(p.amount || 0), 0) || 0

  const stages = {}
  orders?.forEach(o => {
    const s = o.current_stage
    if (s) stages[s] = (stages[s] || 0) + 1
  })

  return { totalOrders, revMonth, payMonth, stages }
}

export async function fetchDashboardTailorWorkload(tenantId) {
  const { data: tailors, error: tErr } = await supabase
    .from('tailors')
    .select('id, name, active')
    .eq('tenant_id', tenantId)

  if (tErr) throw tErr
  if (!tailors || tailors.length === 0) return []

  const tailorIds = tailors.map(t => t.id)

  const { data: assignments, error: aErr } = await supabase
    .from('work_assignments')
    .select(`
      tailor_id,
      orders!inner(current_stage)
    `)
    .in('tailor_id', tailorIds)

  if (aErr) throw aErr

  const workMap = {}
  assignments?.forEach(a => {
    if (!workMap[a.tailor_id]) workMap[a.tailor_id] = { total: 0, inProgress: 0, delivered: 0 }
    workMap[a.tailor_id].total++
    if (a.orders?.current_stage === 'Delivered') {
      workMap[a.tailor_id].delivered++
    } else {
      workMap[a.tailor_id].inProgress++
    }
  })

  return tailors.map(t => ({
    id: t.id,
    name: t.name,
    active: t.active,
    total: workMap[t.id]?.total || 0,
    inProgress: workMap[t.id]?.inProgress || 0,
    delivered: workMap[t.id]?.delivered || 0,
  }))
}
