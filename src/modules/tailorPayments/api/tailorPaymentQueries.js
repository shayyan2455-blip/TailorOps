import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchTailorPayments() {
  const { data, error } = await supabase
    .from('tailor_payments')
    .select('*, tailors(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchTailorsForPayment(tenantId) {
  const { data: ledgers, error } = await supabase.rpc('get_tailor_ledgers', { p_tenant_id: tenantId })
  if (error) throw error
  return (ledgers || []).map(l => ({
    id: l.tailor_id,
    name: l.tailor_name,
    mobile: l.mobile,
    balance: Number(l.balance),
    credit: Number(l.credit_balance),
  })).filter(t => t.balance !== undefined)
}

export async function recordTailorPayment(tenantId, payload) {
  const { data, error } = await supabase.rpc('record_tailor_payment', {
    p_tenant_id: tenantId,
    p_tailor_id: payload.tailor_id,
    p_amount: payload.amount,
    p_payment_date: payload.payment_date,
    p_payment_mode: payload.payment_mode,
    p_notes: payload.notes || null,
  })
  if (error) throw error
  return data
}

export async function deleteTailorPayment(id) {
  const { error } = await supabase.from('tailor_payments').delete().eq('id', id)
  if (error) throw error
}

export async function fetchTailorPaymentForReceipt(paymentId) {
  const { data: payment, error } = await supabase
    .from('tailor_payments')
    .select('*, tailors(name, mobile)')
    .eq('id', paymentId)
    .single()
  if (error) throw error
  return { payment }
}
