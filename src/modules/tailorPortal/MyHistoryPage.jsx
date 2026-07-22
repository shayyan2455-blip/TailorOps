import { useState, useEffect } from 'react'
import { useTopbar } from '../../shared/context/TopbarContext'
import { formatDate } from '../../shared/lib/formatDate'
import { fetchMyHistory } from './api/tailorPortalQueries'

export default function MyHistoryPage() {
  const { setTopbar } = useTopbar()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMyHistory()
      .then(data => setAssignments(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setTopbar('My History', null)
    return () => setTopbar('', null)
  }, [setTopbar])

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
                  {formatDate(a.assigned_at)}
                </td>
                <td style={{ fontSize: 12, opacity: 0.6 }}>
                  {formatDate(a.completed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
