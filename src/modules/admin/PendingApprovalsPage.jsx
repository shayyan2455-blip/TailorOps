import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminListTenants, adminApproveTenant, adminRejectTenant } from './api/adminQueries'

export default function PendingApprovalsPage() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(null)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminListTenants('pending')
      setTenants(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleApprove = async (id) => {
    setActionId(id)
    setError('')
    try {
      await adminApproveTenant(id)
      setTenants(prev => prev.filter(t => t.tenant_id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setActionId(null)
    }
  }

  const handleReject = async (id) => {
    if (!rejectReason.trim()) return
    setActionId(id)
    setError('')
    try {
      await adminRejectTenant(id, rejectReason.trim())
      setTenants(prev => prev.filter(t => t.tenant_id !== id))
      setShowReject(null)
      setRejectReason('')
    } catch (e) {
      setError(e.message)
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h2>Pending Approvals</h2>
        <button className="admin-btn" onClick={load}>Refresh</button>
      </div>

      {error && (
        <div style={{
          background: 'color-mix(in srgb, #e53e3e 10%, transparent)',
          border: '1px solid color-mix(in srgb, #e53e3e 30%, transparent)',
          color: '#e53e3e',
          fontSize: 13,
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 16,
        }}>{error}</div>
      )}

      {loading ? (
        <div style={{ opacity: 0.4, fontSize: 14 }}>Loading...</div>
      ) : tenants.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          opacity: 0.4,
          fontSize: 14,
        }}>
          No pending approvals. All caught up!
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Shop Name</th>
              <th>Owner</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Signup Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.tenant_id}>
                <td>
                  <span
                    style={{ cursor: 'pointer', color: 'var(--main-color)' }}
                    onClick={() => navigate(`/admin/shops/${t.tenant_id}`)}
                  >
                    {t.tenant_name}
                  </span>
                </td>
                <td>{t.owner_name || '—'}</td>
                <td style={{ opacity: 0.6, fontSize: 12 }}>{t.owner_email || '—'}</td>
                <td style={{ opacity: 0.6 }}>{t.owner_mobile || '—'}</td>
                <td style={{ opacity: 0.6, fontSize: 12 }}>
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      className="admin-btn"
                      disabled={actionId === t.tenant_id}
                      onClick={() => handleApprove(t.tenant_id)}
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      {actionId === t.tenant_id ? '...' : 'Approve'}
                    </button>
                    <button
                      className="admin-btn-danger"
                      disabled={actionId === t.tenant_id}
                      onClick={() => setShowReject(showReject === t.tenant_id ? null : t.tenant_id)}
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      Reject
                    </button>
                  </div>
                  {showReject === t.tenant_id && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection *"
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-color)',
                          color: 'var(--text-color)',
                          fontSize: 12,
                          fontFamily: "'IBM Plex Sans', sans-serif",
                          outline: 'none',
                        }}
                        autoFocus
                      />
                      <button
                        className="admin-btn-danger"
                        disabled={!rejectReason.trim() || actionId === t.tenant_id}
                        onClick={() => handleReject(t.tenant_id)}
                        style={{ padding: '6px 14px', fontSize: 12 }}
                      >
                        {actionId === t.tenant_id ? '...' : 'Confirm'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
