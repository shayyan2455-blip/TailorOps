import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useTopbar } from '../../shared/context/TopbarContext'
import { formatDate } from '../../shared/lib/formatDate'
import { fetchTenant } from '../settings/api/settingsQueries'
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from './api/customerQueries'
import CustomerForm from './components/CustomerForm'
import ConfirmModal from '../../shared/components/ConfirmModal'
import './CustomersPage.css'

export default function CustomersPage() {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const { setTopbar } = useTopbar()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [tenant, setTenant] = useState(null)

  useEffect(() => {
    if (tenantId) fetchTenant(tenantId).then(setTenant).catch(() => {})
  }, [tenantId])

  const printCustomers = () => {
    const rows = customers.map(c => `
      <tr>
        <td>${c.name || '—'}</td>
        <td>${c.mobile || '—'}</td>
        <td>${c.address || '—'}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html><head><title>Customers</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12px; color: #111; }
  .identity { text-align: center; margin-bottom: 14px; }
  .shop-name { font-size: 20px; font-weight: 700; }
  .meta { font-size: 11px; color: #555; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
  th { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; font-family: 'Courier New', monospace; }
  .footer { text-align: center; font-size: 10px; color: #666; margin-top: 16px; border-top: 1px solid #ccc; padding-top: 8px; }
</style></head>
<body>
  <div class="identity">
    <div class="shop-name">${tenant?.name || 'Tailor Shop'}</div>
    <div class="meta">Customers — ${customers.length} total</div>
  </div>
  <table>
    <thead><tr><th>Name</th><th>Mobile</th><th>Address</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Generated on ${formatDate(new Date().toISOString().slice(0, 10))} · TailorOps</div>
</body></html>`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none;'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open(); doc.write(html); doc.close()
    iframe.contentWindow.focus()
    setTimeout(() => {
      try { iframe.contentWindow.print() } catch {}
      setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe) }, 1000)
    }, 300)
  }

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchCustomers(search || undefined)
      setCustomers(data)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [search, showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setTopbar('Customers', <button className="c-add-btn" onClick={() => { setEditing(null); setShowForm(true) }}>+ Add Customer</button>)
    return () => setTopbar('', null)
  }, [setTopbar])

  const handleSave = async (payload) => {
    try {
      if (editing) {
        await updateCustomer(editing.id, payload)
        showToast('Customer updated.')
      } else {
        await createCustomer(tenantId, payload)
        showToast('Customer added.')
      }
      setShowForm(false)
      setEditing(null)
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteCustomer(id)
      showToast('Customer deleted.')
      if (detail?.id === id) setDetail(null)
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
    setConfirmDelete(null)
  }

  return (
    <div className="c-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Customers</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="c-add-btn" onClick={printCustomers}>Print PDF</button>
            <button className="c-add-btn" onClick={() => { setEditing(null); setShowForm(true) }}>+ Add Customer</button>
          </div>
        </div>
        <div className="c-search-wrap">
          <input
            className="c-search"
            placeholder="Search by name or mobile..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : customers.length === 0 ? (
        <p className="c-empty">{search ? 'No customers match your search.' : 'No customers yet. Add your first one.'}</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className={detail?.id === c.id ? 'row-active' : ''}>
                  <td>
                    <button className="c-name-link" onClick={() => setDetail(detail?.id === c.id ? null : c)}>
                      {c.name}
                    </button>
                  </td>
                  <td>{c.mobile || '—'}</td>
                  <td className="c-addr">{c.address || '—'}</td>
                  <td className="c-actions">
                    <button className="c-action-btn" onClick={() => { setEditing(c); setShowForm(true) }}>Edit</button>
                    <button className="c-action-btn c-action-destructive" onClick={() => setConfirmDelete(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="c-detail">
          <h4 className="c-detail-name">{detail.name}</h4>
          <div className="c-detail-grid">
            <div><span className="c-detail-label">Mobile</span><span>{detail.mobile || '—'}</span></div>
            <div><span className="c-detail-label">Address</span><span>{detail.address || '—'}</span></div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="c-backdrop" onClick={() => { setShowForm(false); setEditing(null) }}>
          <div className="c-form-modal" onClick={e => e.stopPropagation()}>
            <CustomerForm
              customer={editing}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <ConfirmModal message="Delete this customer?" onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}
