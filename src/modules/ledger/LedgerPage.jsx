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

  const printLedger = () => {
    const currency = tenant?.currency || 'Rs.'
    const rows = filtered.map(row => {
      const bal = Number(row.balance)
      return `
      <tr>
        <td>${row.customer_name || '—'}</td>
        <td class="num">${currency} ${Number(row.total_orders).toFixed(0)}</td>
        <td class="num">${currency} ${Number(row.total_paid).toFixed(0)}</td>
        <td class="num">${currency} ${Math.abs(bal).toFixed(0)}${bal > 0 ? ' due' : bal < 0 ? ' excess' : ''}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html><head><title>Customer Ledger</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12px; color: #111; }
  .identity { text-align: center; margin-bottom: 14px; }
  .shop-name { font-size: 20px; font-weight: 700; }
  .meta { font-size: 11px; color: #555; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
  th { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; font-family: 'Courier New', monospace; }
  .num { text-align: right; font-family: 'Courier New', monospace; }
  .footer { text-align: center; font-size: 10px; color: #666; margin-top: 16px; border-top: 1px solid #ccc; padding-top: 8px; }
</style></head>
<body>
  <div class="identity">
    <div class="shop-name">${tenant?.name || 'Tailor Shop'}</div>
    <div class="meta">Customer Ledger — ${filtered.length} customer${filtered.length !== 1 ? 's' : ''}</div>
  </div>
  <table>
    <thead><tr><th>Customer</th><th class="num">Total Amount</th><th class="num">Total Paid</th><th class="num">Balance</th></tr></thead>
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
        <div className="c-header-row">
          <h3 className="c-title">Customer Ledger</h3>
          <button className="c-add-btn" onClick={printLedger}>Print PDF</button>
        </div>
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
                <th>Actions</th>
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
                      <td className="c-actions">
                        <span style={{ cursor: 'pointer', display: 'inline-flex', verticalAlign: 'middle' }}
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const entries = await fetchCustomerLedger(row.customer_id, tenantId)
                              printLedgerStatement({
                                tenant, partyLabel: 'Customer', partyName: row.customer_name,
                                entries: entries.map(e => ({ ...e, ref: e.invoice_or_order })),
                                closingBalance: row.balance,
                              })
                            } catch (err) { showToast(err.message, 'error') }
                          }}
                          title="Print statement">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        </span>
                      </td>
                    </tr>
                    {expanded === row.customer_id && (
                      <tr key={`${row.customer_id}-detail`}>
                        <td colSpan={5} className="l-detail-cell">
                          {detailLoading ? (
                            <p className="l-detail-loading">Loading...</p>
                          ) : !detail || detail.length === 0 ? (
                            <p className="l-detail-loading">No transactions.</p>
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
