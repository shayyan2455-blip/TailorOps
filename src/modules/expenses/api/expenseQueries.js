import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchExpenses(search) {
  let query = supabase.from('expenses').select('*').order('created_at', { ascending: false })
  if (search) query = query.or(`description.ilike.%${search}%,payee_name.ilike.%${search}%`)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchExpense(id) {
  const { data, error } = await supabase.from('expenses').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createExpense(tenantId, payload) {
  const { data, error } = await supabase.from('expenses').insert({ ...payload, tenant_id: tenantId }).select().single()
  if (error) throw error

  const { data: creditApplied } = await supabase.rpc('apply_expense_credit', {
    p_expense_id: data.id,
    p_tenant_id: tenantId,
  })

  return { expense: data, creditApplied: Number(creditApplied || 0) }
}

export async function updateExpense(id, payload) {
  const { data, error } = await supabase.from('expenses').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}
