import { useState, useEffect } from 'react'
import { fetchMyHistory } from './api/tailorPortalQueries'

export default function MyHistoryPage() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMyHistory()
      .then(data => setAssignments(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="tp-module">
      <header className="tp-header">
        <h3 className="tp-title">My History</h3>
      </header>

      {error && <div className="tp-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p className="tp-empty">Loading...</p>
      ) : assignments.length === 0 ? (
        <p className="tp-empty">No completed work yet.</p>
      ) : (
        <table className="tp-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Garment</th>
              <th>Qty</th>
              <th>Stage</th>
              <th>Assigned</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.assignment_id}>
                <td className="tp-mono">{a.order_number}</td>
                <td style={{ fontSize: 13 }}>{a.garment_name}</td>
                <td>{a.quantity}</td>
                <td><span className="tp-badge">{a.stage}</span></td>
                <td style={{ fontSize: 12, opacity: 0.6 }}>
                  {new Date(a.assigned_at).toLocaleDateString()}
                </td>
                <td style={{ fontSize: 12, opacity: 0.6 }}>
                  {a.completed_at ? new Date(a.completed_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
