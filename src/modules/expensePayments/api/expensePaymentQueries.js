import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchExpensePayments() {
  const { data, error } = await supabase
    .from('expense_payments')
    .select('*, expenses(description, payee_name, total_amount, amount_paid)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchExpensesForPayment(tenantId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, description, payee_name, total_amount, amount_paid, credit')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(e => ({
    ...e,
    balance: Number(e.total_amount) - Number(e.amount_paid),
    credit: Number(e.credit || 0),
    unpaid: Math.max(0, Number(e.total_amount) - Number(e.amount_paid)),
  }))
}

export async function recordExpensePayment(tenantId, payload) {
  const { data, error } = await supabase.rpc('record_expense_payment', {
    p_tenant_id: tenantId,
    p_expense_id: payload.expense_id,
    p_amount: payload.amount,
    p_payment_date: payload.payment_date,
    p_payment_mode: payload.payment_mode,
    p_notes: payload.notes || null,
  })
  if (error) throw error
  return data
}

export async function deleteExpensePayment(id) {
  const { error } = await supabase.from('expense_payments').delete().eq('id', id)
  if (error) throw error
}

export async function fetchExpensePaymentForReceipt(paymentId) {
  const { data: payment, error } = await supabase
    .from('expense_payments')
    .select('*, expenses(description, payee_name, total_amount, amount_paid)')
    .eq('id', paymentId)
    .single()
  if (error) throw error
  return { payment }
}
