import { useState, useEffect } from 'react'
import { fetchMyWork, markStageComplete } from './api/tailorPortalQueries'

export default function MyWorkPage() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [marking, setMarking] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchMyWork()
      setAssignments(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleComplete = async (id) => {
    setMarking(id)
    setError('')
    try {
      await markStageComplete(id)
      setAssignments(prev => prev.filter(a => a.assignment_id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setMarking(null)
    }
  }

  return (
    <div className="tp-module">
      <header className="tp-header">
        <h3 className="tp-title">My Work</h3>
        <button className="tp-btn" onClick={load}>Refresh</button>
      </header>

      {error && <div className="tp-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p className="tp-empty">Loading...</p>
      ) : assignments.length === 0 ? (
        <p className="tp-empty">No pending work assigned to you.</p>
      ) : (
        <table className="tp-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Garment</th>
              <th>Qty</th>
              <th>Stage</th>
              <th>Delivery</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.assignment_id}>
                <td className="tp-mono">{a.order_number}</td>
                <td>{a.customer_name}</td>
                <td style={{ fontSize: 13 }}>{a.garment_name}</td>
                <td>{a.quantity}</td>
                <td><span className="tp-badge">{a.stage}</span></td>
                <td style={{ fontSize: 12, opacity: 0.6 }}>
                  {a.delivery_date ? new Date(a.delivery_date).toLocaleDateString() : '—'}
                </td>
                <td style={{ fontSize: 12, opacity: 0.6, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.notes || '—'}
                </td>
                <td>
                  <button
                    className="tp-btn"
                    disabled={marking === a.assignment_id}
                    onClick={() => handleComplete(a.assignment_id)}
                  >
                    {marking === a.assignment_id ? '...' : 'Mark Complete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
