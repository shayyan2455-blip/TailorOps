import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useTopbar } from '../../shared/context/TopbarContext'
import { fetchExpenseLedgers, fetchExpenseLedgerDetail } from './api/expenseLedgerQueries'
import '../ledger/LedgerPage.css'

export default function ExpenseLedgerPage() {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const { setTopbar } = useTopbar()
  const [ledgers, setLedgers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchExpenseLedgers(tenantId)
      setLedgers(data)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [tenantId, showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setTopbar('Expense Ledger', null)
    return () => setTopbar('', null)
  }, [setTopbar])

  const toggleExpand = async (expenseId) => {
    if (expanded === expenseId) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(expenseId)
    setDetailLoading(true)
    try {
      const data = await fetchExpenseLedgerDetail(expenseId, tenantId)
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
        <h3 className="c-title">Expense Ledger</h3>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : ledgers.length === 0 ? (
        <p className="c-empty">No expenses yet.</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table l-table">
            <thead>
              <tr>
                <th>Expense</th>
                <th>Payee</th>
                <th className="l-num mono">Total Amount</th>
                <th className="l-num mono">Paid</th>
                <th className="l-num mono">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgers.map(row => {
                const bal = Number(row.balance)
                return (
                  <>
                    <tr
                      key={row.expense_id}
                      className={`l-row ${expanded === row.expense_id ? 'l-row--open' : ''}`}
                      onClick={() => toggleExpand(row.expense_id)}
                    >
                      <td>
                        <span className={`l-expand ${expanded === row.expense_id ? 'l-expand--open' : ''}`}>▶</span>
                        {row.description}
                      </td>
                      <td>{row.payee_name}</td>
                      <td className="l-num mono">Rs. {Number(row.total_amount).toFixed(0)}</td>
                      <td className="l-num mono">Rs. {Number(row.amount_paid).toFixed(0)}</td>
                      <td className={`l-num mono l-bal ${bal > 0 ? 'l-due' : bal < 0 ? 'l-excess' : ''}`}>
                        {bal > 0
                          ? `Rs. ${bal.toFixed(0)} due`
                          : bal < 0
                            ? `Rs. ${Math.abs(bal).toFixed(0)} excess`
                            : 'Rs. 0'
                        }
                      </td>
                    </tr>
                    {expanded === row.expense_id && (
                      <tr key={`${row.expense_id}-detail`}>
                        <td colSpan={5} className="l-detail-cell">
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
                                      <td>{entry.date}</td>
                                      <td>
                                        <span className="l-entry-desc">{entry.description}</span>
                                        <span className="l-entry-ref">{entry.ref}</span>
                                      </td>
                                      <td className="l-num">{entry.debit > 0 ? `Rs. ${Number(entry.debit).toFixed(0)}` : '—'}</td>
                                      <td className="l-num">{entry.credit > 0 ? `Rs. ${Number(entry.credit).toFixed(0)}` : '—'}</td>
                                      <td className={`l-num ${entryBal > 0 ? 'l-due' : entryBal < 0 ? 'l-excess' : ''}`}>
                                        {entryBal > 0
                                          ? `Rs. ${entryBal.toFixed(0)}`
                                          : entryBal < 0
                                            ? `Rs. ${Math.abs(entryBal).toFixed(0)}`
                                            : 'Rs. 0'
                                        }
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
