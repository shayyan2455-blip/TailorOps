import { useState, useEffect } from 'react'
import { adminGetMetrics, adminGetPendingEmails, adminMarkEmailSent } from './api/adminQueries'

export default function MetricsPage() {
  const [metrics, setMetrics] = useState(null)
  const [emails, setEmails] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    adminGetMetrics().then(setMetrics).catch(e => setError(e.message))
    adminGetPendingEmails().then(setEmails).catch(() => {})
  }, [])

  const handleMarkSent = async (id) => {
    try {
      await adminMarkEmailSent(id)
      setEmails(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  if (!metrics) {
    return <div style={{ opacity: 0.4, fontSize: 14 }}>Loading metrics...</div>
  }

  return (
    <div>
      <div className="admin-header">
        <h2>Metrics</h2>
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

      <div className="admin-card-grid">
        <div className="admin-card">
          <div className="admin-card-value">{metrics.total_shops}</div>
          <div className="admin-card-label">Total Shops</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-value" style={{ color: 'var(--success)' }}>{metrics.active_shops}</div>
          <div className="admin-card-label">Active</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-value" style={{ color: '#df8908' }}>{metrics.pending_shops}</div>
          <div className="admin-card-label">Pending</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-value" style={{ color: 'var(--danger)' }}>{metrics.rejected_shops}</div>
          <div className="admin-card-label">Rejected</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-value" style={{ color: '#e53e3e' }}>{metrics.suspended_shops}</div>
          <div className="admin-card-label">Suspended</div>
        </div>
        <div className="admin-card">
          <div className="admin-card-value">{metrics.added_this_month}</div>
          <div className="admin-card-label">Added This Month</div>
        </div>
      </div>

      {emails.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 500,
            fontSize: 18,
            margin: '0 0 16px',
          }}>
            Pending Email Notifications ({emails.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {emails.map(email => (
              <div key={email.id} style={{
                background: 'var(--second-bg-color)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '14px 16px',
                fontSize: 13,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <strong>To:</strong> {email.to_email}
                    <span style={{ opacity: 0.4, margin: '0 8px' }}>·</span>
                    <strong>Subject:</strong> {email.subject}
                  </div>
                  <button
                    className="admin-btn-outline"
                    onClick={() => handleMarkSent(email.id)}
                    style={{ fontSize: 11, padding: '4px 12px', flexShrink: 0 }}
                  >
                    Mark sent
                  </button>
                </div>
                <pre style={{
                  fontSize: 12,
                  opacity: 0.6,
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  fontFamily: "'IBM Plex Mono', monospace",
                  lineHeight: 1.5,
                }}>{email.body}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
