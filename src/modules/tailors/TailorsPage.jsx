import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../shared/lib/formatDate'
import { fetchTenant } from '../settings/api/settingsQueries'
import { fetchTailors, createTailor, updateTailor, deleteTailor, fetchWorkAssignments, removeAssignment } from './api/tailorQueries'
import TailorForm from './components/TailorForm'
import { useTopbar } from '../../shared/context/TopbarContext'
import ConfirmModal from '../../shared/components/ConfirmModal'
import './TailorsPage.css'

export default function TailorsPage() {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const { setTopbar } = useTopbar()
  const [tailors, setTailors] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [tenant, setTenant] = useState(null)

  useEffect(() => {
    if (tenantId) fetchTenant(tenantId).then(setTenant).catch(() => {})
  }, [tenantId])

  const printTailors = () => {
    const rows = tailors.map(t => `
      <tr>
        <td>${t.name || '—'}</td>
        <td>${t.mobile || '—'}</td>
        <td>${t.active ? 'Active' : 'Inactive'}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html><head><title>Tailors</title>
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
    <div class="meta">Tailors — ${tailors.length} total</div>
  </div>
  <table>
    <thead><tr><th>Name</th><th>Mobile</th><th>Status</th></tr></thead>
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
      const data = await fetchTailors(search || undefined)
      setTailors(data)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [search, showToast])

  useEffect(() => { load() }, [load])

  const loadAssignments = useCallback(async (tailorId) => {
    try {
      const data = await fetchWorkAssignments(tailorId)
      setAssignments(data)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }, [showToast])

  useEffect(() => {
    if (selected) loadAssignments(selected.id)
    else setAssignments([])
  }, [selected, loadAssignments])

  useEffect(() => {
    setTopbar('Tailors', <button className="c-add-btn" onClick={() => { setEditing(null); setShowForm(true) }}>+ Add Tailor</button>)
    return () => setTopbar('', null)
  }, [setTopbar])

  const handleSave = async (payload) => {
    try {
      if (editing) {
        await updateTailor(editing.id, payload)
        showToast('Tailor updated.')
      } else {
        await createTailor(tenantId, payload)
        showToast('Tailor added.')
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
      await deleteTailor(id)
      showToast('Tailor deleted.')
      if (selected?.id === id) setSelected(null)
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
    setConfirmDelete(null)
  }

  const handleUnassign = async (assignmentId) => {
    try {
      await removeAssignment(assignmentId)
      showToast('Tailor unassigned.')
      loadAssignments(selected?.id)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  return (
    <div className="c-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Tailors</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="c-add-btn" onClick={printTailors}>Print PDF</button>
            <button className="c-add-btn" onClick={() => { setEditing(null); setShowForm(true) }}>+ Add Tailor</button>
          </div>
        </div>
        <div className="c-search-wrap">
          <input className="c-search" placeholder="Search by name or mobile..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : tailors.length === 0 ? (
        <p className="c-empty">{search ? 'No tailors match your search.' : 'No tailors yet. Add your first one.'}</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tailors.map(t => (
                <tr key={t.id} className={selected?.id === t.id ? 'row-active' : ''}>
                  <td>
                    <button className="c-name-link" onClick={() => setSelected(selected?.id === t.id ? null : t)}>
                      {t.name}
                    </button>
                  </td>
                  <td>{t.mobile || '—'}</td>
                  <td>
                    <span className={`t-status ${t.active ? 't-status--active' : 't-status--inactive'}`}>
                      {t.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="c-actions">
                    <button className="c-action-btn" onClick={() => { setEditing(t); setShowForm(true) }}>Edit</button>
                    <button className="c-action-btn c-action-destructive" onClick={() => setConfirmDelete(t.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="c-detail">
          <h4 className="c-detail-name">{selected.name} — Workload</h4>
          {assignments.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.5 }}>No current assignments.</p>
          ) : (
            <table className="c-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Stage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.id}>
                    <td className="mono">{a.orders?.order_number || '—'}</td>
                    <td>{a.orders?.customers?.name || '—'}</td>
                    <td><span className={`o-stage o-stage--${a.stage?.toLowerCase()}`}>{a.stage}</span></td>
                    <td><button className="c-action-btn c-action-destructive" onClick={() => handleUnassign(a.id)}>Unassign</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showForm && (
        <div className="c-backdrop" onClick={() => { setShowForm(false); setEditing(null) }}>
          <div className="c-form-modal" onClick={e => e.stopPropagation()}>
            <TailorForm tailor={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null) }} />
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <ConfirmModal message="Delete this tailor?" onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}
