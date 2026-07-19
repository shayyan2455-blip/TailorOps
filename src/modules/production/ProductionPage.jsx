import { useState, useEffect, useCallback } from 'react'
import { fetchProductionOrders, transitionOrder } from './api/productionQueries'
import './ProductionPage.css'

const STAGES = ['Booked', 'Cutting', 'Stitching', 'Ready', 'Delivered']
const STAGE_COLORS = {
  Booked: '--booked',
  Cutting: '--cutting',
  Stitching: '--stitching',
  Ready: '--ready',
  Delivered: '--delivered',
}

export default function ProductionPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [moving, setMoving] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchProductionOrders()
      setOrders(data)
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleTransition = async (orderId, newStage) => {
    setMoving(orderId)
    try {
      await transitionOrder(orderId, newStage)
      load()
    } catch {} finally {
      setMoving(null)
    }
  }

  const grouped = {}
  STAGES.forEach(s => { grouped[s] = [] })
  orders.forEach(o => {
    if (grouped[o.current_stage]) grouped[o.current_stage].push(o)
  })

  return (
    <div className="p-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Production Floor</h3>
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : (
        <div className="p-board">
          {STAGES.map(stage => (
            <div key={stage} className={`p-column p-col${STAGE_COLORS[stage]}`}>
              <div className="p-col-header">
                <span className="p-col-dot" />
                <span className="p-col-name">{stage}</span>
                <span className="p-col-count">{grouped[stage].length}</span>
              </div>
              <div className="p-col-cards">
                {grouped[stage].length === 0 && (
                  <div className="p-col-empty">No orders</div>
                )}
                {grouped[stage].map(order => (
                  <div
                    key={order.id}
                    className={`p-card ${detail?.id === order.id ? 'p-card--active' : ''} ${moving === order.id ? 'p-card--moving' : ''}`}
                    onClick={() => setDetail(detail?.id === order.id ? null : order)}
                  >
                    <div className="p-card-head">
                      <span className="p-card-order">{order.order_number}</span>
                      <span className="p-card-total">Rs.{Number(order.total_amount).toFixed(0)}</span>
                    </div>
                    <div className="p-card-customer">{order.customers?.name || '—'}</div>
                    {order.delivery_date && (
                      <div className="p-card-delivery">Due {order.delivery_date}</div>
                    )}

                    <div className="p-card-actions">
                      {stage !== 'Booked' && (
                        <button
                          className="p-card-btn p-card-btn--prev"
                          onClick={(e) => { e.stopPropagation(); handleTransition(order.id, STAGES[STAGES.indexOf(stage) - 1]) }}
                          disabled={moving === order.id}
                        >
                          ←
                        </button>
                      )}
                      <span className="p-card-stage-label">{stage}</span>
                      {stage !== 'Delivered' && (
                        <button
                          className="p-card-btn p-card-btn--next"
                          onClick={(e) => { e.stopPropagation(); handleTransition(order.id, STAGES[STAGES.indexOf(stage) + 1]) }}
                          disabled={moving === order.id}
                        >
                          →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="c-detail" style={{ marginTop: 24 }}>
          <div className="c-detail-row">
            <div><span className="c-detail-label">Order #</span><span>{detail.order_number}</span></div>
            <div><span className="c-detail-label">Customer</span><span>{detail.customers?.name}</span></div>
            <div><span className="c-detail-label">Stage</span><span className={`o-stage o-stage--${detail.current_stage?.toLowerCase()}`}>{detail.current_stage}</span></div>
            <div><span className="c-detail-label">Total</span><span>Rs. {Number(detail.total_amount).toFixed(0)}</span></div>
            <div><span className="c-detail-label">Delivery</span><span>{detail.delivery_date || '—'}</span></div>
          </div>
          {detail.order_items?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span className="c-detail-label">Items</span>
              <div className="o-detail-items">
                {detail.order_items.map((item, i) => (
                  <div key={i} className="o-detail-item">
                    <span>{item.garment_name}</span>
                    <span>{item.quantity} x Rs.{Number(item.rate).toFixed(0)}</span>
                    <span>Rs.{Number(item.amount).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
