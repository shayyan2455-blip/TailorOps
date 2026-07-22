import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchTenant(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Tenant not found')
  return data[0]
}

export async function updateTenant(tenantId, payload) {
  const { data, error } = await supabase
    .from('tenants')
    .update(payload)
    .eq('id', tenantId)
    .select()
  if (error) throw error
  return data?.[0] || null
}
