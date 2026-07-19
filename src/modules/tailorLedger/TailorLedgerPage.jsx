import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchTailorLedgers, fetchTailorLedger } from './api/tailorLedgerQueries'
import '../ledger/LedgerPage.css'

export default function TailorLedgerPage() {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const [ledgers, setLedgers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchTailorLedgers(tenantId)
      setLedgers(data)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [tenantId, showToast])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (tailorId) => {
    if (expanded === tailorId) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(tailorId)
    setDetailLoading(true)
    try {
      const data = await fetchTailorLedger(tailorId, tenantId)
      setDetail(data)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="c-module">
      <header className="c-header">
        <h3 className="c-title">Tailor Ledger</h3>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : ledgers.length === 0 ? (
        <p className="c-empty">No tailor payments yet.</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table l-table">
            <thead>
              <tr>
                <th>Tailor</th>
                <th className="l-num">Total Paid</th>
                <th>Mobile</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.map(row => (
                <>
                  <tr
                    key={row.tailor_id}
                    className={`l-row ${expanded === row.tailor_id ? 'l-row--open' : ''}`}
                    onClick={() => toggleExpand(row.tailor_id)}
                  >
                    <td>
                      <span className={`l-expand ${expanded === row.tailor_id ? 'l-expand--open' : ''}`}>▶</span>
                      {row.tailor_name}
                    </td>
                    <td className="l-num mono">Rs. {Number(row.total_paid).toFixed(0)}</td>
                    <td>{row.mobile || '—'}</td>
                  </tr>
                  {expanded === row.tailor_id && (
                    <tr key={`${row.tailor_id}-detail`}>
                      <td colSpan={3} className="l-detail-cell">
                        {detailLoading ? (
                          <p className="l-detail-loading">Loading...</p>
                        ) : !detail || detail.length === 0 ? (
                          <p className="l-detail-loading">No payments recorded.</p>
                        ) : (
                          <table className="l-subtable">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th className="l-num">Amount (Rs.)</th>
                                <th>Mode</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.map((entry, i) => (
                                <tr key={i} className="l-entry l-entry--payment">
                                  <td>{entry.date}</td>
                                  <td>{entry.description}</td>
                                  <td className="l-num">Rs. {Number(entry.amount).toFixed(0)}</td>
                                  <td><span className="pmt-mode">{entry.mode}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
