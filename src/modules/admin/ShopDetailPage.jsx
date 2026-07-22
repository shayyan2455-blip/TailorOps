import { useState, useEffect } from 'react'
import { useTopbar } from '../../shared/context/TopbarContext'
import { useParams, Link } from 'react-router-dom'
import { formatDate } from '../../shared/lib/formatDate'
import { adminGetTenant, adminGetAuditLog } from './api/adminQueries'

export default function ShopDetailPage() {
  const { tenantId } = useParams()
  const { setTopbar } = useTopbar()
  const [tenant, setTenant] = useState(null)
  const [auditLog, setAuditLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    Promise.all([
      adminGetTenant(tenantId),
      adminGetAuditLog(tenantId),
    ])
      .then(([t, log]) => {
        setTenant(t)
        setAuditLog(log || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [tenantId])

  useEffect(() => {
    setTopbar(tenant?.tenant_name || 'Shop Detail', null)
    return () => setTopbar('', null)
  }, [tenant])

  if (loading) {
    return <div style={{ opacity: 0.4, fontSize: 14 }}>Loading...</div>
  }

  if (error) {
    return (
      <div>
        <div style={{
          background: 'color-mix(in srgb, #e53e3e 10%, transparent)',
          border: '1px solid color-mix(in srgb, #e53e3e 30%, transparent)',
          color: '#e53e3e',
          fontSize: 13,
          padding: '10px 14px',
          borderRadius: 8,
        }}>{error}</div>
        <Link to="/admin/shops" className="admin-btn-outline" style={{ display: 'inline-block', marginTop: 16 }}>
          ← Back to all shops
        </Link>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div>
        <div style={{ opacity: 0.4, fontSize: 14 }}>Shop not found.</div>
        <Link to="/admin/shops" className="admin-btn-outline" style={{ display: 'inline-block', marginTop: 16 }}>
          ← Back to all shops
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link to="/admin/shops" style={{
          fontSize: 13,
          opacity: 0.5,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 12,
        }}>
          ← Back to all shops
        </Link>
        <div className="admin-header" style={{ marginBottom: 0 }}>
          <div>
            <h2>{tenant.tenant_name}</h2>
            <span style={{ fontSize: 12, opacity: 0.4, fontFamily: "'IBM Plex Mono', monospace" }}>
              {tenant.slug}
            </span>
          </div>
          <span className={`admin-status ${tenant.status}`} style={{ fontSize: 13, padding: '4px 14px' }}>
            {tenant.status}
          </span>
        </div>
      </div>

      <div className="admin-two-col" style={{ gap: 24, marginBottom: 32 }}>
        <div className="admin-detail-card">
          <div className="admin-detail-card-title">Shop Info</div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Name</span>
            <span>{tenant.tenant_name}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Slug</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{tenant.slug}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Status</span>
            <span className={`admin-status ${tenant.status}`}>{tenant.status}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Address</span>
            <span style={{ opacity: tenant.address ? 1 : 0.3 }}>{tenant.address || 'Not set'}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Phone</span>
            <span style={{ opacity: tenant.phone ? 1 : 0.3 }}>{tenant.phone || 'Not set'}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Currency</span>
            <span>{tenant.currency}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Created</span>
            <span>{formatDate(tenant.created_at)}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Last Status Change</span>
            <span>{tenant.status_updated_at ? formatDate(tenant.status_updated_at) : '—'}</span>
          </div>
          {tenant.rejection_reason && (
            <div className="admin-detail-row">
              <span className="admin-detail-label">Rejection Reason</span>
              <span style={{ color: 'var(--danger)' }}>{tenant.rejection_reason}</span>
            </div>
          )}
        </div>

        <div className="admin-detail-card">
          <div className="admin-detail-card-title">Owner Info</div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Name</span>
            <span>{tenant.owner_name || '—'}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Email</span>
            <span style={{ fontSize: 12 }}>{tenant.owner_email || '—'}</span>
          </div>
          <div className="admin-detail-row">
            <span className="admin-detail-label">Mobile</span>
            <span>{tenant.owner_mobile || '—'}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 500,
          fontSize: 18,
          margin: '0 0 16px',
        }}>
          Status History
        </h3>
        {auditLog.length === 0 ? (
          <div style={{ opacity: 0.4, fontSize: 13 }}>No history recorded yet.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Performed By</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map(entry => (
                <tr key={entry.log_id}>
                  <td style={{ fontSize: 12, opacity: 0.6 }}>
                    {formatDate(entry.created_at)}
                  </td>
                  <td>
                    <span className={`admin-status ${entry.action === 'approved' || entry.action === 'reactivated' ? 'active' : entry.action === 'rejected' ? 'rejected' : 'suspended'}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{entry.admin_email || '—'}</td>
                  <td style={{ opacity: entry.reason ? 1 : 0.3 }}>{entry.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
