import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchMeasurementsByCustomer(customerId) {
  const { data, error } = await supabase
    .from('measurements')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function saveMeasurement(tenantId, customerId, orderId, data) {
  const { data: result, error } = await supabase
    .from('measurements')
    .upsert({
      tenant_id: tenantId,
      customer_id: customerId,
      order_id: orderId,
      data,
    }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return result
}
