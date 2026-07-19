import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchTailorLedgers(tenantId) {
  const { data, error } = await supabase.rpc('get_tailor_ledgers', { p_tenant_id: tenantId })
  if (error) throw error
  return data
}

export async function fetchTailorLedger(tailorId, tenantId) {
  const { data, error } = await supabase.rpc('get_tailor_ledger', {
    p_tailor_id: tailorId,
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data
}
