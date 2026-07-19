import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchCustomers(search) {
  let query = supabase.from('customers').select('*').order('created_at', { ascending: false })

  if (search) {
    query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchCustomer(id) {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createCustomer(tenantId, payload) {
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...payload, tenant_id: tenantId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCustomer(id, payload) {
  const { data, error } = await supabase
    .from('customers')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCustomer(id) {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}
