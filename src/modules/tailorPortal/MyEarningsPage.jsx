import { useState, useEffect } from 'react'
import { useTopbar } from '../../shared/context/TopbarContext'
import { fetchMyLedger } from './api/tailorPortalQueries'

export default function MyEarningsPage() {
  const { setTopbar } = useTopbar()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMyLedger()
      .then(data => setEntries(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setTopbar('My Earnings', null)
    return () => setTopbar('', null)
  }, [setTopbar])

  const balance = entries.length > 0 ? entries[entries.length - 1].running_balance : 0

  return (
    <div className="tp-module">
      <header className="tp-header">
        <h3 className="tp-title">My Earnings</h3>
      </header>

      {error && <div className="tp-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p className="tp-empty">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="tp-empty">No earnings recorded yet.</p>
      ) : (
        <>
          <div style={{
            background: 'var(--second-bg-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            gap: 32,
          }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Earned</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 500 }}>
                Rs. {entries.reduce((s, e) => s + Number(e.debit), 0).toFixed(0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Paid</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 500 }}>
                Rs. {entries.reduce((s, e) => s + Number(e.credit), 0).toFixed(0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Balance</div>
              <div style={{
                fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 500,
                color: balance >= 0 ? 'var(--success)' : 'var(--danger)',
              }}>
                Rs. {Number(balance).toFixed(0)}
              </div>
            </div>
          </div>

          <table className="tp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Ref</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12, opacity: 0.6 }}>{new Date(e.date).toLocaleDateString()}</td>
                  <td>{e.description}</td>
                  <td className="tp-mono">{e.ref}</td>
                  <td style={{ color: 'var(--main-color)' }}>Rs. {Number(e.debit).toFixed(0)}</td>
                  <td style={{ color: 'var(--success)' }}>Rs. {Number(e.credit).toFixed(0)}</td>
                  <td style={{ fontWeight: 500 }}>Rs. {Number(e.running_balance).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
