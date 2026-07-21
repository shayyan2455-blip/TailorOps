import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../shared/lib/supabaseClient'
import { fetchTenant, updateTenant } from './api/settingsQueries'

export default function TeamPage() {
  const { tenantId, profile } = useAuth()
  const [members, setMembers] = useState([])
  const [tailors, setTailors] = useState([])
  const [shopName, setShopName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [invite, setInvite] = useState({ email: '', full_name: '', role: 'admin', tailor_id: '' })
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState(null)

  const isOwner = profile?.role === 'owner'
  const canInvite = isOwner || profile?.role === 'admin'

  const load = async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_team_members', { p_tenant_id: tenantId })
      if (error) throw error
      setMembers(data || [])

      const { data: tData } = await supabase
        .from('tailors')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('name')
      setTailors(tData || [])

      const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .single()
      if (tenant) setShopName(tenant.name)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantId])

  const handleInvite = async () => {
    if (!invite.email || !invite.full_name) return
    setInviting(true)
    setError('')
    try {
      const { data, error } = await supabase.rpc('invite_team_member', {
        p_email: invite.email,
        p_full_name: invite.full_name,
        p_role: invite.role,
        p_tailor_id: invite.role === 'tailor' && invite.tailor_id
          ? invite.tailor_id === '__new' ? null : invite.tailor_id
          : null,
      })
      if (error) throw error

      // Create auth user + send email via Vercel API
      const payload = {
        email: data.email,
        fullName: data.full_name,
        role: data.role,
        tailorId: data.tailor_id,
        tenantId: data.tenant_id,
        tempPassword: data.temp_password,
        shopName: data.shop_name,
      }
      console.log('Invite payload:', payload)
      const emailRes = await fetch('/api/send-invite-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const emailBody = await emailRes.text()
      console.log('API response:', emailRes.status, emailBody)
      if (!emailRes.ok) {
        let msg
        try { msg = JSON.parse(emailBody).error } catch { msg = emailBody }
        throw new Error(msg || 'Failed to send invitation')
      }

      setShowInvite(false)
      setInvite({ email: '', full_name: '', role: 'admin', tailor_id: '' })
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (userId) => {
    if (!window.confirm('Remove this team member?')) return
    setRemoving(userId)
    setError('')
    try {
      const { error } = await supabase.rpc('remove_team_member', {
        p_user_id: userId,
        p_tenant_id: tenantId,
      })
      if (error) throw error
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    } catch (e) {
      setError(e.message)
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div>
      <header className="tp-header">
        <h3 className="tp-title">Team</h3>
        {canInvite && (
          <button className="tp-btn" onClick={() => setShowInvite(true)}>Invite Member</button>
        )}
      </header>

      {error && <div className="tp-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p className="tp-empty">Loading...</p>
      ) : members.length === 0 ? (
        <p className="tp-empty">No team members yet.</p>
      ) : (
        <table className="tp-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Linked Tailor</th>
              <th>Joined</th>
              {isOwner && <th></th>}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.user_id}>
                <td>{m.full_name || '—'}</td>
                <td style={{ fontSize: 12, opacity: 0.6 }}>{m.email || '—'}</td>
                <td>
                  <span className="tp-badge" style={{
                    background: m.role === 'owner' ? 'color-mix(in srgb, var(--main-color) 15%, transparent)' :
                               m.role === 'admin' ? 'color-mix(in srgb, var(--success) 15%, transparent)' :
                               'color-mix(in srgb, #df8908 15%, transparent)',
                    color: m.role === 'owner' ? 'var(--main-color)' :
                           m.role === 'admin' ? 'var(--success)' : '#df8908',
                  }}>
                    {m.role}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>{m.tailor_name || '—'}</td>
                <td style={{ fontSize: 12, opacity: 0.6 }}>
                  {new Date(m.created_at).toLocaleDateString()}
                </td>
                {isOwner && m.role !== 'owner' && (
                  <td>
                    <button
                      className="tp-btn"
                      style={{ background: 'var(--danger)', padding: '4px 10px', fontSize: 11 }}
                      disabled={removing === m.user_id}
                      onClick={() => handleRemove(m.user_id)}
                    >
                      {removing === m.user_id ? '...' : 'Remove'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showInvite && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'color-mix(in srgb, #000 60%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            width: '100%', maxWidth: 400,
            padding: '28px 24px',
          }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 20, margin: '0 0 20px' }}>
              Invite Team Member
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 500, opacity: 0.8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                Email *
                <input className="c-form-input" type="email" value={invite.email}
                  onChange={e => setInvite(p => ({ ...p, email: e.target.value }))}
                  placeholder="colleague@example.com" />
              </label>

              <label style={{ fontSize: 13, fontWeight: 500, opacity: 0.8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                Full Name *
                <input className="c-form-input" value={invite.full_name}
                  onChange={e => setInvite(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="Their full name" />
              </label>

              <label style={{ fontSize: 13, fontWeight: 500, opacity: 0.8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                Role
                <select className="c-form-input" value={invite.role}
                  onChange={e => setInvite(p => ({ ...p, role: e.target.value, tailor_id: '' }))}>
                  <option value="admin">Admin (full access)</option>
                  <option value="tailor">Tailor (limited access)</option>
                </select>
              </label>

              {invite.role === 'tailor' && (
                <label style={{ fontSize: 13, fontWeight: 500, opacity: 0.8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  Link to Tailor
                  <select className="c-form-input" value={invite.tailor_id}
                    onChange={e => setInvite(p => ({ ...p, tailor_id: e.target.value }))}>
                    <option value="">— Select existing tailor —</option>
                    <option value="__new">+ Create new tailor</option>
                    {tailors.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="c-form-cancel" onClick={() => setShowInvite(false)}>Cancel</button>
              <button className="c-form-save" disabled={inviting || !invite.email || !invite.full_name} onClick={handleInvite}>
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
