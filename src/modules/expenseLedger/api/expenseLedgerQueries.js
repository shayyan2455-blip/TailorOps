import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchExpenseLedgers(tenantId) {
  const { data, error } = await supabase.rpc('get_expense_ledgers', { p_tenant_id: tenantId })
  if (error) throw error
  return data
}

export async function fetchExpenseLedgerDetail(expenseId, tenantId) {
  const { data, error } = await supabase.rpc('get_expense_ledger_detail', {
    p_expense_id: expenseId,
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data
}
