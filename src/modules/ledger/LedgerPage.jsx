import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useTopbar } from '../../shared/context/TopbarContext'
import { formatDate } from '../../shared/lib/formatDate'
import { fetchTenant } from '../settings/api/settingsQueries'
import { printLedgerStatement } from '../../shared/lib/printLedger'
import { fetchCustomerLedgers, fetchCustomerLedger } from './api/ledgerQueries'
import './LedgerPage.css'

export default function LedgerPage() {
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
      const data = await fetchCustomerLedgers(tenantId)
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
    setTopbar('Customer Ledger', null)
    return () => setTopbar('', null)
  }, [setTopbar])

  const toggleExpand = async (customerId) => {
    if (expanded === customerId) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(customerId)
    setDetailLoading(true)
    try {
      const data = await fetchCustomerLedger(customerId, tenantId)
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
    return (row.customer_name || '').toLowerCase().includes(q)
  })

  return (
    <div className="c-module">
      <header className="c-header">
        <h3 className="c-title">Customer Ledger</h3>
        <div style={{ marginTop: 8 }}>
          <input className="c-search" placeholder="Search by customer name…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : ledgers.length === 0 ? (
        <p className="c-empty">No customers yet.</p>
      ) : filtered.length === 0 ? (
        <p className="c-empty">No customers match your search.</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table l-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="l-num mono">Total Amount</th>
                <th className="l-num mono">Total Paid</th>
                <th className="l-num mono">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const bal = Number(row.balance)
                const isExcess = bal < 0
                return (
                  <>
                    <tr
                      key={row.customer_id}
                      className={`l-row ${expanded === row.customer_id ? 'l-row--open' : ''}`}
                      onClick={() => toggleExpand(row.customer_id)}
                    >
                      <td>
                        <span className={`l-expand ${expanded === row.customer_id ? 'l-expand--open' : ''}`}>▶</span>
                        {row.customer_name}
                      </td>
                      <td className="l-num mono">Rs. {Number(row.total_orders).toFixed(0)}</td>
                      <td className="l-num mono">Rs. {Number(row.total_paid).toFixed(0)}</td>
                      <td className={`l-num mono l-bal ${isExcess ? 'l-excess' : 'l-due'}`}>
                        {isExcess
                          ? `Rs. ${Math.abs(bal).toFixed(0)} excess`
                          : bal > 0
                            ? `Rs. ${bal.toFixed(0)} due`
                            : 'Rs. 0'
                        }
                      </td>
                    </tr>
                    {expanded === row.customer_id && (
                      <tr key={`${row.customer_id}-detail`}>
                        <td colSpan={4} className="l-detail-cell">
                          {detailLoading ? (
                            <p className="l-detail-loading">Loading...</p>
                          ) : !detail || detail.length === 0 ? (
                            <p className="l-detail-loading">No transactions.</p>
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                                <button className="c-action-btn" onClick={() => printLedgerStatement({
                                  tenant,
                                  partyLabel: 'Customer',
                                  partyName: row.customer_name,
                                  entries: detail.map(e => ({ ...e, ref: e.invoice_or_order })),
                                  closingBalance: row.balance,
                                })}>Print</button>
                              </div>
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
                                        <span className="l-entry-ref">{entry.invoice_or_order}</span>
                                      </td>
                                      <td className="l-num">{entry.debit > 0 ? `Rs. ${Number(entry.debit).toFixed(0)}` : '—'}</td>
                                      <td className="l-num">{entry.credit > 0 ? `Rs. ${Number(entry.credit).toFixed(0)}` : '—'}</td>
                                      <td className={`l-num ${entryBal < 0 ? 'l-excess' : entryBal > 0 ? 'l-due' : ''}`}>
                                        {entryBal < 0
                                          ? `Rs. ${Math.abs(entryBal).toFixed(0)}`
                                          : `Rs. ${entryBal.toFixed(0)}`
                                        }
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                            </>
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
