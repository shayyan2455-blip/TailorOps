import { useState, useEffect } from 'react'
import { useTopbar } from '../../shared/context/TopbarContext'
import { adminGetAuditLog } from './api/adminQueries'
import { useNavigate } from 'react-router-dom'

export default function AuditLogPage() {
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { setTopbar } = useTopbar()

  useEffect(() => {
    setLoading(true)
    adminGetAuditLog()
      .then(data => setLog(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setTopbar('Audit Log', null)
    return () => setTopbar('', null)
  }, [])

  return (
    <div>
      <div className="admin-header">
        <h2>Audit Log</h2>
        <button className="admin-btn" onClick={() => {
          setLoading(true)
          adminGetAuditLog()
            .then(data => setLog(data || []))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
        }}>
          Refresh
        </button>
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
      ) : log.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.4, fontSize: 14 }}>
          No audit log entries yet.
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shop</th>
              <th>Action</th>
              <th>Performed By</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {log.map(entry => (
              <tr key={entry.log_id}>
                <td style={{ fontSize: 12, opacity: 0.6, whiteSpace: 'nowrap' }}>
                  {new Date(entry.created_at).toLocaleString()}
                </td>
                <td>
                  <span
                    style={{ cursor: 'pointer', color: 'var(--main-color)' }}
                    onClick={() => navigate(`/admin/shops/${entry.tenant_id}`)}
                  >
                    {entry.tenant_name}
                  </span>
                </td>
                <td>
                  <span className={`admin-status ${entry.action === 'approved' || entry.action === 'reactivated' ? 'active' : entry.action === 'rejected' ? 'rejected' : 'suspended'}`}>
                    {entry.action}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>{entry.admin_email || '—'}</td>
                <td style={{ opacity: entry.reason ? 1 : 0.3, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.reason || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
