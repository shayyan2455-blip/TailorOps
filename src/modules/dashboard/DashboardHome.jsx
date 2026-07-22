import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useTopbar } from '../../shared/context/TopbarContext'
import { formatDate } from '../../shared/lib/formatDate'
import { fetchDashboardMetrics, fetchDashboardTailorWorkload } from './api/dashboardQueries'
import { fetchProductionOrders } from '../production/api/productionQueries'
import './DashboardHome.css'

const STAGES = ['Booked', 'Cutting', 'Stitching', 'Ready', 'Delivered']
const STAGE_COLORS = {
  Booked: '--booked',
  Cutting: '--cutting',
  Stitching: '--stitching',
  Ready: '--ready',
  Delivered: '--delivered',
}

export default function DashboardHome() {
  const { profile, tenantId } = useAuth()
  const navigate = useNavigate()
  const { setTopbar } = useTopbar()
  const [kpi, setKpi] = useState(null)
  const [boardOrders, setBoardOrders] = useState([])
  const [tailorData, setTailorData] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [kpiData, prodOrders, tData] = await Promise.all([
        fetchDashboardMetrics(tenantId),
        fetchProductionOrders(),
        fetchDashboardTailorWorkload(tenantId),
      ])
      setKpi(kpiData)
      setBoardOrders(prodOrders)
      setTailorData(tData)
    } catch {} finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setTopbar('Dashboard', <button className="btn-primary" onClick={() => navigate('/dashboard/orders')} style={{ fontSize: 12, padding: '7px 16px', gap: 0 }}>+ New order</button>)
    return () => setTopbar('', null)
  }, [setTopbar, navigate])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const name = profile?.full_name?.split(' ')[0] || 'there'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SO'

  const grouped = {}
  STAGES.forEach(s => { grouped[s] = [] })
  boardOrders.forEach(o => {
    if (grouped[o.current_stage]) grouped[o.current_stage].push(o)
  })

  const recentOrders = [...boardOrders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 4)
  const pending = Object.entries(grouped).filter(([s]) => s !== 'Delivered').reduce((sum, [, arr]) => sum + arr.length, 0)

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">{greeting}, {name}</h1>
          <p className="page-sub">Here's how the shop floor looks today</p>
        </div>
        <div className="topbar-actions">
          <input className="topbar-search" placeholder="Search orders, customers…" />
          <button className="btn-primary" onClick={() => navigate('/dashboard/orders')}>+ New order</button>
          <div className="topbar-avatar">{initials}</div>
        </div>
      </div>

      {loading ? (
        <p className="c-empty">Loading dashboard...</p>
      ) : (
        <>
          <div className="metrics">
            <div className="metric-card">
              <div className="metric-label">Orders this month</div>
              <div className="metric-value">{kpi?.totalOrders || 0}</div>
              <div className="metric-delta">{kpi?.stages?.Booked || 0} booked</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Pending orders</div>
              <div className="metric-value">{pending}</div>
              <div className="metric-delta neg">{kpi?.stages?.Ready || 0} ready for delivery</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Revenue (MTD)</div>
              <div className="metric-value">Rs. {(kpi?.revMonth || 0).toFixed(0)}</div>
              <div className="metric-delta">{kpi?.payMonth ? `Rs. ${kpi.payMonth.toFixed(0)} collected` : ''}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Balance due</div>
              <div className="metric-value">Rs. {((kpi?.revMonth || 0) - (kpi?.payMonth || 0)).toFixed(0)}</div>
              <div className="metric-delta neg">Across {pending} orders</div>
            </div>
          </div>

          <div className="section-block">
            <div className="block-head">
              <h2 className="block-title">Production floor</h2>
              <button className="block-link" onClick={() => navigate('/dashboard/production')}>View board →</button>
            </div>
            <div className="board">
              {STAGES.map(stage => (
                <div key={stage} className="col">
                  <div className="col-head">
                    {stage} <span className="count">{grouped[stage].length}</span>
                  </div>
                  {grouped[stage].length === 0 ? (
                    <div className="col-empty">—</div>
                  ) : (
                    grouped[stage].slice(0, 2).map(order => (
                      <div key={order.id} className="ocard">
                        <span className="ocard-id">{order.order_number}</span>
                        <div className="ocard-name">{order.customers?.name || '—'} — {order.order_items?.[0]?.garment_name || ''}</div>
                        <div className="ocard-meta">
                          {order.delivery_date ? `Due ${formatDate(order.delivery_date)}` : ''}
                          {order.work_assignments?.[0]?.tailors?.name ? ` · ${order.work_assignments[0].tailors.name}` : ''}
                        </div>
                      </div>
                    ))
                  )}
                  {grouped[stage].length > 2 && <div className="col-more">+{grouped[stage].length - 2} more</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="two-col">
            <div className="section-block">
              <div className="block-head">
                <h2 className="block-title">Recent orders</h2>
                <button className="block-link" onClick={() => navigate('/dashboard/orders')}>View all →</button>
              </div>
              <table>
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>Stage</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {recentOrders.length === 0 ? (
                    <tr><td colSpan={4} style={{ opacity: 0.5, textAlign: 'center', padding: 24 }}>No orders yet</td></tr>
                  ) : (
                    recentOrders.map(o => (
                      <tr key={o.id}>
                        <td className="td-mono">{o.order_number}</td>
                        <td>{o.customers?.name || '—'}</td>
                        <td><span className={`stage-pill stage--${o.current_stage?.toLowerCase()}`}>{o.current_stage}</span></td>
                        <td>Rs. {Number(o.total_amount).toFixed(0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="section-block">
              <div className="block-head">
                <h2 className="block-title">Tailor workload</h2>
              </div>
              {tailorData.length === 0 ? (
                <p style={{ opacity: 0.5, fontSize: 13 }}>No tailors yet</p>
              ) : (
                tailorData.slice(0, 3).map(t => (
                  <div key={t.id} className="widget-item">
                    <div>
                      <div className="widget-name">{t.name}</div>
                      <div className="widget-sub">{t.inProgress} in progress · {t.delivered} delivered</div>
                    </div>
                    <div className="widget-val">{t.total} orders</div>
                  </div>
                ))
              )}
              <div className="widget-item" style={{ marginTop: 8, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
                <div>
                  <div className="widget-name">Ready to deliver</div>
                  <div className="widget-sub">Orders in Ready stage</div>
                </div>
                <div className="widget-val">{kpi?.stages?.Ready || 0}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
