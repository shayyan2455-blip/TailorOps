import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchCustomerLedgers(tenantId) {
  const { data, error } = await supabase.rpc('get_customer_ledgers', { p_tenant_id: tenantId })
  if (error) throw error
  return data
}

export async function fetchCustomerLedger(customerId, tenantId) {
  const { data, error } = await supabase.rpc('get_customer_ledger', {
    p_customer_id: customerId,
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data
}
