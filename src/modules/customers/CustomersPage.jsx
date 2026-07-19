import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from './api/customerQueries'
import CustomerForm from './components/CustomerForm'
import './CustomersPage.css'

export default function CustomersPage() {
  const { tenantId } = useAuth()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchCustomers(search || undefined)
      setCustomers(data)
    } catch {} finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleSave = async (payload) => {
    if (editing) {
      await updateCustomer(editing.id, payload)
    } else {
      await createCustomer(tenantId, payload)
    }
    setShowForm(false)
    setEditing(null)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer?')) return
    await deleteCustomer(id)
    if (detail?.id === id) setDetail(null)
    load()
  }

  return (
    <div className="c-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Customers</h3>
          <button className="c-add-btn" onClick={() => { setEditing(null); setShowForm(true) }}>
            + Add Customer
          </button>
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
                    <button className="c-action-btn c-action-destructive" onClick={() => handleDelete(c.id)}>Delete</button>
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
    </div>
  )
}
