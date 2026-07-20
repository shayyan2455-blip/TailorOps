import { supabase } from '../../../shared/lib/supabaseClient'

export async function fetchMyWork() {
  const { data, error } = await supabase.rpc('get_tailor_my_work')
  if (error) throw error
  return data || []
}

export async function fetchMyHistory() {
  const { data, error } = await supabase.rpc('get_tailor_my_history')
  if (error) throw error
  return data || []
}

export async function fetchMyLedger() {
  const { data, error } = await supabase.rpc('get_my_tailor_ledger')
  if (error) throw error
  return data || []
}

export async function markStageComplete(assignmentId) {
  const { data, error } = await supabase.rpc('tailor_mark_stage_complete', {
    p_assignment_id: assignmentId,
  })
  if (error) throw error
  return data
}
