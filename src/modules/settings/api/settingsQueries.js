import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchTenant(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()
  if (error) throw error
  return data
}

export async function updateTenant(tenantId, payload) {
  const { data, error } = await supabase
    .from('tenants')
    .update(payload)
    .eq('id', tenantId)
    .select()
    .single()
  if (error) throw error
  return data
}
