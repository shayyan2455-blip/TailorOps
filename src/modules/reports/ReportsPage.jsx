import { useState, useEffect, useCallback } from 'react'
import { fetchKpiData, fetchTailorWorkload } from './api/reportQueries'
import './ReportsPage.css'

const STAGE_LABELS = {
  Pending: 'P', Cutting: 'C', Sewing: 'S',
  Finishing: 'F', Ready: 'R', Delivered: 'D',
}
const STAGE_COLORS = {
  Pending: '#6b7280', Cutting: '#f59e0b', Sewing: '#3b82f6',
  Finishing: '#8b5cf6', Ready: '#38a169', Delivered: '#1f2937',
}

export default function ReportsPage() {
  const [kpi, setKpi] = useState(null)
  const [tailors, setTailors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [kpiData, tailorData] = await Promise.all([
        fetchKpiData(),
        fetchTailorWorkload(),
      ])
      setKpi(kpiData)
      setTailors(tailorData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="c-module"><p className="c-empty">Loading reports...</p></div>
  if (error) return <div className="c-module"><p className="c-empty">Error: {error}</p></div>
  if (!kpi) return <div className="c-module"><p className="c-empty">No data.</p></div>

  const maxTimeline = Math.max(...kpi.timelineData.map(d => d.revenue), 1)
  const maxStage = Math.max(...Object.values(kpi.stages), 1)
  const maxTailor = Math.max(...tailors.map(t => t.total), 1)

  return (
    <div className="c-module">
      <header className="c-header">
        <h3 className="c-title">Reports</h3>
      </header>

      <div className="r-grid">
        <div className="r-card r-kpi">
          <h4>Revenue</h4>
          <div className="r-kpi-row"><span>Today</span><span className="r-kpi-val">Rs. {kpi.revToday.toFixed(0)}</span></div>
          <div className="r-kpi-row"><span>This Week</span><span className="r-kpi-val">Rs. {kpi.revWeek.toFixed(0)}</span></div>
          <div className="r-kpi-row"><span>This Month</span><span className="r-kpi-val">Rs. {kpi.revMonth.toFixed(0)}</span></div>
          <div className="r-kpi-row" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 6 }}>
            <span>Payments (month)</span><span className="r-kpi-val">Rs. {kpi.payMonth.toFixed(0)}</span>
          </div>
        </div>

        <div className="r-card r-kpi">
          <h4>Orders</h4>
          <div className="r-kpi-row"><span>Total</span><span className="r-kpi-val">{kpi.totalOrders}</span></div>
          {Object.entries(kpi.stages).map(([stage, count]) => (
            <div key={stage} className="r-kpi-row">
              <span>{stage}</span>
              <span className="r-kpi-val">{count}</span>
            </div>
          ))}
        </div>

        <div className="r-card r-top-cust">
          <h4>Top Customers</h4>
          {kpi.topCustomers.length === 0 ? (
            <p style={{ opacity: 0.4, fontSize: 13 }}>No data</p>
          ) : (
            kpi.topCustomers.map((c, i) => (
              <div key={i} className="r-kpi-row">
                <span>{i + 1}. {c.name}</span>
                <span className="r-kpi-val">Rs. {c.revenue.toFixed(0)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="r-grid r-grid-2col">
        <div className="r-card">
          <h4>Order Status Distribution</h4>
          <div className="r-bars-vert">
            {Object.entries(STAGE_LABELS).map(([stage, label]) => {
              const count = kpi.stages[stage] || 0
              const pct = (count / maxStage) * 100
              return (
                <div key={stage} className="r-bar-col">
                  <span className="r-bar-count">{count}</span>
                  <div className="r-bar-track-v">
                    <div
                      className="r-bar-fill-v"
                      style={{ height: `${Math.max(pct, count > 0 ? 4 : 0)}%`, background: STAGE_COLORS[stage] }}
                    />
                  </div>
                  <span className="r-bar-label">{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="r-card">
          <h4>Revenue (Last 30 Days)</h4>
          <div className="r-bars-vert">
            {kpi.timelineData.map(d => {
              const pct = (d.revenue / maxTimeline) * 100
              return (
                <div key={d.date} className="r-bar-col">
                  <div className="r-bar-track-v">
                    <div
                      className="r-bar-fill-v"
                      style={{ height: `${Math.max(pct, d.revenue > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="r-bar-label" title={d.date}>
                    {d.date.slice(5)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="r-card">
        <h4>Tailor Workload</h4>
        {tailors.length === 0 ? (
          <p style={{ opacity: 0.4, fontSize: 13 }}>No tailors</p>
        ) : (
          <div className="r-bars-horiz">
            {tailors.map(t => {
              const ipPct = (t.inProgress / maxTailor) * 100
              const dPct = (t.delivered / maxTailor) * 100
              return (
                <div key={t.id} className="r-bar-row">
                  <span className="r-bar-name">{t.name}</span>
                  <div className="r-bar-track-h">
                    <div className="r-bar-fill-h" style={{ width: `${ipPct}%` }} title={`In progress: ${t.inProgress}`} />
                    <div className="r-bar-fill-h r-bar-fill-delivered" style={{ width: `${dPct}%` }} title={`Delivered: ${t.delivered}`} />
                  </div>
                  <span className="r-bar-total">{t.total}</span>
                </div>
              )
            })}
          </div>
        )}
        <div className="r-legend">
          <span><span className="r-legend-dot" style={{ background: 'var(--main-color)' }} /> In Progress</span>
          <span><span className="r-legend-dot" style={{ background: '#38a169' }} /> Delivered</span>
        </div>
      </div>
    </div>
  )
}
