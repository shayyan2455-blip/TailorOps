import { useState, useEffect } from 'react'
import { useTopbar } from '../../shared/context/TopbarContext'
import { useNavigate } from 'react-router-dom'
import { adminGetMetrics, adminGetPendingEmails, adminMarkEmailSent, adminGetShopGrowth } from './api/adminQueries'
import { adminGetAuditLog } from './api/adminQueries'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

export default function MetricsPage() {
  const navigate = useNavigate()
  const { setTopbar } = useTopbar()
  const [metrics, setMetrics] = useState(null)
  const [growth, setGrowth] = useState([])
  const [activity, setActivity] = useState([])
  const [emails, setEmails] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    adminGetMetrics().then(setMetrics).catch(e => setError(e.message))
    adminGetShopGrowth().then(setGrowth).catch(() => {})
    adminGetAuditLog(null).then(d => setActivity(d?.slice(0, 6) || [])).catch(() => {})
    adminGetPendingEmails().then(setEmails).catch(() => {})
  }, [])

  useEffect(() => {
    setTopbar('Metrics', null)
    return () => setTopbar('', null)
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
    return <div className="admin-loading">Loading metrics...</div>
  }

  const totalAll = metrics.total_shops || 1
  const maxGrowth = Math.max(...growth.map(g => Number(g.shop_count)), 1)

  return (
    <div>
      <div className="admin-header">
        <h2>Platform Metrics</h2>
      </div>

      {error && <div className="admin-error-banner">{error}</div>}

      {metrics.pending_shops > 0 && (
        <div className="admin-callout">
          <div className="admin-callout-text">
            🕓 <b>{metrics.pending_shops}</b> {metrics.pending_shops === 1 ? 'shop is' : 'shops are'} waiting for approval
            {metrics.oldest_pending_days > 0 && <span> — oldest pending {metrics.oldest_pending_days} {metrics.oldest_pending_days === 1 ? 'day' : 'days'}</span>}.
          </div>
          <button className="admin-callout-btn" onClick={() => navigate('/admin/pending')}>
            Review queue →
          </button>
        </div>
      )}

      <div className="admin-metrics-grid">
        <div className="m-card"><div className="m-label">Total shops</div><div className="m-value m-total">{metrics.total_shops}</div></div>
        <div className="m-card"><div className="m-label">Active</div><div className="m-value m-active">{metrics.active_shops}</div></div>
        <div className="m-card"><div className="m-label">Pending</div><div className="m-value m-pending">{metrics.pending_shops}</div></div>
        <div className="m-card"><div className="m-label">Rejected</div><div className="m-value m-rejected">{metrics.rejected_shops}</div></div>
        <div className="m-card"><div className="m-label">Suspended</div><div className="m-value m-suspended">{metrics.suspended_shops}</div></div>
        <div className="m-card"><div className="m-label">Added this month</div><div className="m-value m-new">{metrics.added_this_month}</div></div>
      </div>

      <div className="admin-two-col">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h3 className="admin-panel-title">Shop growth — last 6 months</h3>
            <span className="admin-panel-link" onClick={() => navigate('/admin/shops')}>All shops →</span>
          </div>
          <div className="admin-chart">
            {growth.map((g, i) => (
              <div key={g.month} className="admin-bar-col">
                <div
                  className={`admin-bar${i === growth.length - 1 ? ' current' : ''}`}
                  style={{ height: `${(Number(g.shop_count) / maxGrowth) * 100}%` }}
                />
                <div className="admin-bar-month">{g.month}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <h3 className="admin-panel-title">Status distribution</h3>
          </div>
          {[
            { label: 'Active', count: metrics.active_shops, color: 'var(--green)' },
            { label: 'Pending', count: metrics.pending_shops, color: 'var(--amber)' },
            { label: 'Rejected', count: metrics.rejected_shops, color: 'var(--thread-soft)' },
            { label: 'Suspended', count: metrics.suspended_shops, color: 'var(--thread)' },
          ].map(s => (
            <div key={s.label} className="admin-dist-row">
              <div className="admin-dist-label">{s.label}</div>
              <div className="admin-dist-track">
                <div className="admin-dist-fill" style={{ width: `${(s.count / totalAll) * 100}%`, background: s.color }} />
              </div>
              <div className="admin-dist-count">{s.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-two-col">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h3 className="admin-panel-title">Recent activity</h3>
            <span className="admin-panel-link" onClick={() => navigate('/admin/audit')}>Full audit log →</span>
          </div>
          {activity.length === 0 && <div className="admin-empty-feed">No recent activity.</div>}
          {activity.map(a => (
            <div key={a.log_id} className="admin-activity-item">
              <span className={`admin-activity-dot ${a.action?.toLowerCase() === 'approved' ? 'approve' : a.action?.toLowerCase() === 'rejected' ? 'reject' : 'suspend'}`} />
              <span className="admin-activity-text">
                <b>{a.tenant_name}</b> {a.action}{a.reason ? ` — ${a.reason}` : ''}
              </span>
              <span className="admin-activity-time">{timeAgo(a.created_at)}</span>
            </div>
          ))}
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <h3 className="admin-panel-title">Pending emails {emails.length > 0 && <span className="admin-email-count">({emails.length})</span>}</h3>
          </div>
          {emails.length === 0 && <div className="admin-empty-feed">No pending emails.</div>}
          {emails.map(email => (
            <div key={email.id} className="admin-email-item">
              <div className="admin-email-top">
                <div className="admin-email-meta">
                  <b>To:</b> {email.to_email} <span className="admin-email-sep">·</span> <b>Subject:</b> {email.subject}
                </div>
                <button className="admin-email-btn" onClick={() => handleMarkSent(email.id)}>Mark sent</button>
              </div>
              <pre className="admin-email-body">{email.body}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
