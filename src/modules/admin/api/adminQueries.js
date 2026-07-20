import { supabase } from '../../../shared/lib/supabaseClient'

export async function adminListTenants(status) {
  const { data, error } = await supabase.rpc('admin_list_tenants', {
    p_status: status || null,
  })
  if (error) throw error
  return data
}

export async function adminGetTenant(tenantId) {
  const { data, error } = await supabase.rpc('admin_get_tenant', {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data?.[0] || null
}

export async function adminApproveTenant(tenantId) {
  const { data, error } = await supabase.rpc('admin_approve_tenant', {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data
}

export async function adminRejectTenant(tenantId, reason) {
  const { data, error } = await supabase.rpc('admin_reject_tenant', {
    p_tenant_id: tenantId,
    p_reason: reason,
  })
  if (error) throw error
  return data
}

export async function adminSuspendTenant(tenantId, reason) {
  const { data, error } = await supabase.rpc('admin_suspend_tenant', {
    p_tenant_id: tenantId,
    p_reason: reason || null,
  })
  if (error) throw error
  return data
}

export async function adminReactivateTenant(tenantId) {
  const { data, error } = await supabase.rpc('admin_reactivate_tenant', {
    p_tenant_id: tenantId,
  })
  if (error) throw error
  return data
}

export async function adminGetMetrics() {
  const { data, error } = await supabase.rpc('admin_get_metrics')
  if (error) throw error
  return data?.[0] || null
}

export async function adminGetAuditLog(tenantId) {
  const { data, error } = await supabase.rpc('admin_get_audit_log', {
    p_tenant_id: tenantId || null,
  })
  if (error) throw error
  return data
}

export async function adminGetPendingEmails() {
  const { data, error } = await supabase.rpc('admin_get_pending_emails')
  if (error) throw error
  return data
}

export async function adminMarkEmailSent(emailId) {
  const { error } = await supabase.rpc('admin_mark_email_sent', {
    p_email_id: emailId,
  })
  if (error) throw error
}
