import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useTopbar } from '../../shared/context/TopbarContext'
import { formatDate } from '../../shared/lib/formatDate'
import { fetchTenant } from '../settings/api/settingsQueries'
import { printLedgerStatement } from '../../shared/lib/printLedger'
import { fetchTailorLedgers, fetchTailorLedgerDetail } from './api/tailorLedgerQueries'
import '../ledger/LedgerPage.css'

export default function TailorLedgerPage() {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const { setTopbar } = useTopbar()
  const [ledgers, setLedgers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [tenant, setTenant] = useState(null)

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

  useEffect(() => {
    if (tenantId) fetchTenant(tenantId).then(setTenant).catch(() => {})
  }, [tenantId])

  useEffect(() => {
    setTopbar('Tailor Ledger', null)
    return () => setTopbar('', null)
  }, [setTopbar])

  const toggleExpand = async (tailorId) => {
    if (expanded === tailorId) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(tailorId)
    setDetailLoading(true)
    try {
      const data = await fetchTailorLedgerDetail(tailorId, tenantId)
      setDetail(data)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const filtered = ledgers.filter(row => {
    if (!search) return true
    const q = search.toLowerCase()
    return (row.tailor_name || '').toLowerCase().includes(q)
  })

  return (
    <div className="c-module">
      <header className="c-header">
        <h3 className="c-title">Tailor Ledger</h3>
        <div style={{ marginTop: 8 }}>
          <input className="c-search" placeholder="Search by tailor name…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : ledgers.length === 0 ? (
        <p className="c-empty">No tailor payments yet.</p>
      ) : filtered.length === 0 ? (
        <p className="c-empty">No tailors match your search.</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table l-table">
            <thead>
              <tr>
                <th>Tailor</th>
                <th className="l-num mono">Total Amount</th>
                <th className="l-num mono">Total Paid</th>
                <th className="l-num mono">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const bal = Number(row.balance)
                return (
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
                      <td className="l-num mono">Rs. {Number(row.total_amount).toFixed(0)}</td>
                      <td className="l-num mono">Rs. {Number(row.total_paid).toFixed(0)}</td>
                      <td className={`l-num mono l-bal ${bal > 0 ? 'l-due' : bal < 0 ? 'l-excess' : ''}`}>
                        {bal > 0
                          ? `Rs. ${bal.toFixed(0)} due`
                          : bal < 0
                            ? `Rs. ${Math.abs(bal).toFixed(0)} excess`
                            : 'Rs. 0'
                        }
                        <span style={{ cursor: 'pointer', marginLeft: 8, display: 'inline-flex', verticalAlign: 'middle' }}
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const entries = await fetchTailorLedgerDetail(row.tailor_id, tenantId)
                              printLedgerStatement({
                                tenant, partyLabel: 'Tailor', partyName: row.tailor_name,
                                entries, closingBalance: row.balance,
                              })
                            } catch (err) { showToast(err.message, 'error') }
                          }}
                          title="Print statement">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </span>
                      </td>
                    </tr>
                    {expanded === row.tailor_id && (
                      <tr key={`${row.tailor_id}-detail`}>
                        <td colSpan={4} className="l-detail-cell">
                          {detailLoading ? (
                            <p className="l-detail-loading">Loading...</p>
                          ) : !detail || detail.length === 0 ? (
                            <p className="l-detail-loading">No entries.</p>
                          ) : (
                            <table className="l-subtable">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th className="l-num">Debit (Rs.)</th>
                                    <th className="l-num">Credit (Rs.)</th>
                                    <th className="l-num">Balance (Rs.)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detail.map((entry, i) => {
                                    const entryBal = Number(entry.running_balance)
                                    return (
                                      <tr key={i} className={`l-entry l-entry--${entry.entry_type}`}>
                                        <td>{formatDate(entry.date)}</td>
                                        <td>
                                          <span className="l-entry-desc">{entry.description}</span>
                                          <span className="l-entry-ref">{entry.ref}</span>
                                        </td>
                                        <td className="l-num">{entry.debit > 0 ? `Rs. ${Number(entry.debit).toFixed(0)}` : '—'}</td>
                                        <td className="l-num">{entry.credit > 0 ? `Rs. ${Number(entry.credit).toFixed(0)}` : '—'}</td>
                                        <td className={`l-num ${entryBal > 0 ? 'l-due' : ''}`}>
                                          Rs. {entryBal.toFixed(0)}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
