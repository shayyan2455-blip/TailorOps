import { useState, useEffect } from 'react'
import { useTopbar } from '../../shared/context/TopbarContext'
import { useNavigate } from 'react-router-dom'
import { formatDate } from '../../shared/lib/formatDate'
import { adminListTenants, adminSuspendTenant, adminReactivateTenant } from './api/adminQueries'

const STATUSES = ['all', 'active', 'pending', 'rejected', 'suspended']

export default function AllShopsPage() {
  const [tenants, setTenants] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [showSuspend, setShowSuspend] = useState(null)
  const navigate = useNavigate()
  const { setTopbar } = useTopbar()

  const load = async (status) => {
    setLoading(true)
    try {
      const data = await adminListTenants(status === 'all' ? null : status)
      setTenants(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(filter) }, [filter])

  useEffect(() => {
    setTopbar('All Shops', <button className="admin-btn" onClick={() => load(filter)}>Refresh</button>)
    return () => setTopbar('', null)
  }, [load, filter])

  const handleSuspend = async (id) => {
    if (!suspendReason.trim()) return
    setActionId(id)
    try {
      await adminSuspendTenant(id, suspendReason.trim())
      setShowSuspend(null)
      setSuspendReason('')
      await load(filter)
    } catch (e) {
      setError(e.message)
    } finally {
      setActionId(null)
    }
  }

  const handleReactivate = async (id) => {
    setActionId(id)
    try {
      await adminReactivateTenant(id)
      await load(filter)
    } catch (e) {
      setError(e.message)
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h2>All Shops</h2>
        <button className="admin-btn" onClick={() => load(filter)}>Refresh</button>
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

      <div className="admin-filter-bar">
        {STATUSES.map(s => (
          <button
            key={s}
            className={`admin-filter-btn${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ opacity: 0.4, fontSize: 14 }}>Loading...</div>
      ) : tenants.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.4, fontSize: 14 }}>
          No shops found.
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Shop Name</th>
              <th>Owner</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created</th>
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
                <td>
                  <span className={`admin-status ${t.status}`}>{t.status}</span>
                </td>
                <td style={{ opacity: 0.6, fontSize: 12 }}>
                  {formatDate(t.created_at)}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {t.status === 'active' && (
                      <button
                        className="admin-btn-outline"
                        onClick={() => setShowSuspend(showSuspend === t.tenant_id ? null : t.tenant_id)}
                        style={{ fontSize: 11, padding: '4px 12px', color: '#e53e3e', borderColor: 'color-mix(in srgb, #e53e3e 40%, transparent)' }}
                      >
                        Suspend
                      </button>
                    )}
                    {t.status === 'suspended' && (
                      <button
                        className="admin-btn"
                        disabled={actionId === t.tenant_id}
                        onClick={() => handleReactivate(t.tenant_id)}
                        style={{ padding: '4px 12px', fontSize: 11 }}
                      >
                        {actionId === t.tenant_id ? '...' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                  {showSuspend === t.tenant_id && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={suspendReason}
                        onChange={e => setSuspendReason(e.target.value)}
                        placeholder="Reason (optional)"
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
                        disabled={actionId === t.tenant_id}
                        onClick={() => handleSuspend(t.tenant_id)}
                        style={{ padding: '4px 12px', fontSize: 11 }}
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
