import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  fetchProfitSummary,
  fetchRevenueMetrics,
  fetchOrdersByStage,
  fetchExpensesBreakdown,
  fetchTailorPerformance,
  fetchOrderRevenueDetail,
} from './api/reportQueries'
import './ReportsPage.css'

const RANGE_PRESETS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'lastMonth' },
  { label: 'Custom', value: 'custom' },
]

function rangeDates(preset) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const end = new Date(y, m, d).toISOString().slice(0, 10)

  if (preset === 'week') {
    const start = new Date(y, m, d - ((d + 6 - 1) % 7 + 1)).toISOString().slice(0, 10)
    return { start, end }
  }
  if (preset === 'month') {
    const start = new Date(y, m, 1).toISOString().slice(0, 10)
    return { start, end }
  }
  if (preset === 'lastMonth') {
    const start = new Date(y, m - 1, 1).toISOString().slice(0, 10)
    const end = new Date(y, m, 0).toISOString().slice(0, 10)
    return { start, end }
  }
  return { start: end, end }
}

export default function ReportsPage() {
  const { tenantId } = useAuth()
  const printRef = useRef(null)

  const [preset, setPreset] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [summary, setSummary] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [stages, setStages] = useState({})
  const [expenses, setExpenses] = useState([])
  const [tailors, setTailors] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError('')

    const { start, end } = preset === 'custom'
      ? { start: customStart, end: customEnd }
      : rangeDates(preset)

    if (!start || !end) { setLoading(false); return }

    try {
      const [sum, met, stg, exp, tl, ord] = await Promise.all([
        fetchProfitSummary(tenantId, start, end),
        fetchRevenueMetrics(tenantId, start, end),
        fetchOrdersByStage(tenantId, start, end),
        fetchExpensesBreakdown(tenantId, start, end),
        fetchTailorPerformance(tenantId),
        fetchOrderRevenueDetail(tenantId, start, end),
      ])
      setSummary(sum)
      setMetrics(met)
      setStages(stg)
      setExpenses(exp)
      setTailors(tl)
      setOrders(ord)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, preset, customStart, customEnd])

  useEffect(() => { load() }, [load])

  const profitMargin = metrics && metrics.totalRevenue > 0
    ? ((summary?.net_profit || 0) / metrics.totalRevenue * 100).toFixed(1)
    : '—'

  const maxStageCount = Math.max(...Object.values(stages), 1)

  const handlePrint = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head>
        <title>Reports - TailorOps</title>
        <style>
          @page { margin: 16mm 12mm }
          body { font-family: 'IBM Plex Sans', sans-serif; font-size: 12px; color: #111; padding: 0; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
          th { font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; }
          h2 { font-family: Georgia, serif; font-weight: 500; font-size: 16px; margin: 24px 0 12px; }
        </style>
      </head><body>
      <h2 style="margin-top:0">Reports — ${preset}</h2>
      ${printRef.current?.innerHTML || ''}
      </body></html>
    `)
    w.document.close()
    setTimeout(() => { w.print(); w.close() }, 300)
  }

  const StageBar = ({ stage, count, max }) => {
    const pct = max > 0 ? (count / max) * 100 : 0
    return (
      <div className="rp-bar-col">
        <span className="rp-bar-count">{count}</span>
        <div className="rp-bar-track-v">
          <div className="rp-bar-fill-v" style={{ height: `${Math.max(pct, count > 0 ? 6 : 0)}%` }} />
        </div>
        <span className="rp-bar-label">{stage}</span>
      </div>
    )
  }

  return (
    <div className="c-module">
      <header className="c-header">
        <h3 className="c-title">Reports</h3>
        <div className="rp-toolbar">
          <div className="rp-range">
            {RANGE_PRESETS.map(r => (
              <button
                key={r.value}
                className={`rp-range-btn${preset === r.value ? ' active' : ''}`}
                onClick={() => setPreset(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="rp-custom-dates">
              <input type="date" className="rp-date-input" value={customStart}
                onChange={e => setCustomStart(e.target.value)} />
              <span style={{ opacity: 0.4 }}>—</span>
              <input type="date" className="rp-date-input" value={customEnd}
                onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}
          <button className="rp-print-btn" onClick={handlePrint}>Export PDF</button>
        </div>
      </header>

      {error && <div className="c-form-error" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p className="c-empty">Loading reports...</p>
      ) : (
        <div ref={printRef}>
          {/* ── Net Profit Hero ── */}
          <div className="rp-hero">
            <div className="rp-hero-top">
              <div className="rp-hero-label">Net Profit</div>
              <div className="rp-hero-value">Rs. {(summary?.net_profit || 0).toFixed(0)}</div>
            </div>
            <div className="rp-hero-formula">
              <span>Customer Payments</span>
              <span className="rp-op">−</span>
              <span>Tailor Payments</span>
              <span className="rp-op">−</span>
              <span>Expenses Paid</span>
              <span className="rp-op">=</span>
              <span className="rp-hero-result">Net Profit</span>
            </div>
            <div className="rp-hero-waterfall">
              <div className="rp-wf-bar rp-wf-positive" style={{ flex: summary?.total_customer_payments || 1 }}>
                <span className="rp-wf-label">Rs. {(summary?.total_customer_payments || 0).toFixed(0)}</span>
              </div>
              <div className="rp-wf-bar rp-wf-negative" style={{ flex: summary?.total_tailor_payments || 1 }}>
                <span className="rp-wf-label">−Rs. {(summary?.total_tailor_payments || 0).toFixed(0)}</span>
              </div>
              <div className="rp-wf-bar rp-wf-negative" style={{ flex: Math.max(summary?.total_expenses_paid || 0, 1) }}>
                <span className="rp-wf-label">−Rs. {(summary?.total_expenses_paid || 0).toFixed(0)}</span>
              </div>
              <div className="rp-wf-bar rp-wf-result" style={{ flex: Math.abs(summary?.net_profit || 1) }}>
                <span className="rp-wf-label">Rs. {(summary?.net_profit || 0).toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* ── Revenue Metrics ── */}
          <div className="rp-metrics">
            <div className="rp-metric">
              <div className="rp-metric-label">Total Revenue</div>
              <div className="rp-metric-value">Rs. {(metrics?.totalRevenue || 0).toFixed(0)}</div>
            </div>
            <div className="rp-metric">
              <div className="rp-metric-label">Outstanding Balance</div>
              <div className="rp-metric-value rp-metric-warn">Rs. {(metrics?.outstanding || 0).toFixed(0)}</div>
            </div>
            <div className="rp-metric">
              <div className="rp-metric-label">Avg. Order Value</div>
              <div className="rp-metric-value">Rs. {(metrics?.avgOrderValue || 0).toFixed(0)}</div>
            </div>
            <div className="rp-metric">
              <div className="rp-metric-label">Profit Margin</div>
              <div className="rp-metric-value" style={{ color: (summary?.net_profit || 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {profitMargin}{profitMargin !== '—' ? '%' : ''}
              </div>
            </div>
          </div>

          <div className="rp-two-col">
            {/* ── Orders by Stage ── */}
            <div className="rp-card">
              <h4 className="rp-card-title">Orders by Stage</h4>
              {Object.keys(stages).length === 0 ? (
                <p className="rp-card-empty">No orders in range</p>
              ) : (
                <div className="rp-bars-vert">
                  {['Booked', 'Cutting', 'Stitching', 'Ready', 'Delivered'].map(s => (
                    <StageBar key={s} stage={s} count={stages[s] || 0} max={maxStageCount} />
                  ))}
                </div>
              )}
            </div>

            {/* ── Expenses Breakdown ── */}
            <div className="rp-card">
              <h4 className="rp-card-title">Expenses Breakdown</h4>
              {expenses.length === 0 ? (
                <p className="rp-card-empty">No expenses in range</p>
              ) : (
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th>Payee</th>
                      <th>Total</th>
                      <th>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e, i) => (
                      <tr key={i}>
                        <td>{e.payee}</td>
                        <td>Rs. {e.total.toFixed(0)}</td>
                        <td>Rs. {e.paid.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Tailor Performance ── */}
          <div className="rp-card">
            <h4 className="rp-card-title">Tailor Performance</h4>
            {tailors.length === 0 ? (
              <p className="rp-card-empty">No tailors</p>
            ) : (
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>Tailor</th>
                    <th>Total Assigned</th>
                    <th>Total Paid</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {tailors.map(t => (
                    <tr key={t.tailor_id}>
                      <td>{t.tailor_name}</td>
                      <td>Rs. {Number(t.total_amount).toFixed(0)}</td>
                      <td>Rs. {Number(t.total_paid).toFixed(0)}</td>
                      <td className={Number(t.balance) >= 0 ? '' : 'rp-negative'}>
                        Rs. {Number(t.balance).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Order Revenue Detail ── */}
          <div className="rp-card">
            <h4 className="rp-card-title">Order Revenue Detail</h4>
            {orders.length === 0 ? (
              <p className="rp-card-empty">No orders in range</p>
            ) : (
              <div className="rp-table-wrap">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Stage</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id}>
                        <td className="rp-mono">{o.order_number}</td>
                        <td>{o.customer_name}</td>
                        <td><span className="rp-badge">{o.current_stage}</span></td>
                        <td>Rs. {o.total_amount.toFixed(0)}</td>
                        <td>Rs. {o.total_paid.toFixed(0)}</td>
                        <td className={o.balance > 0 ? 'rp-negative' : ''}>
                          Rs. {o.balance.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
