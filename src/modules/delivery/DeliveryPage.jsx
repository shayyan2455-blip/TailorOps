import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../../context/ToastContext'
import { useTopbar } from '../../shared/context/TopbarContext'
import { formatDate } from '../../shared/lib/formatDate'
import { fetchReadyOrders, fetchTodayDeliveries, markDelivered } from './api/deliveryQueries'
import './DeliveryPage.css'

export default function DeliveryPage() {
  const { showToast } = useToast()
  const { setTopbar } = useTopbar()
  const [tab, setTab] = useState('ready')
  const [readyOrders, setReadyOrders] = useState([])
  const [todayDeliveries, setTodayDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [delivering, setDelivering] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [ready, delivered] = await Promise.all([
        fetchReadyOrders(),
        fetchTodayDeliveries(),
      ])
      setReadyOrders(ready)
      setTodayDeliveries(delivered)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setTopbar('Delivery', null)
    return () => setTopbar('', null)
  }, [setTopbar])

  const handleDeliver = async (orderId) => {
    setDelivering(orderId)
    try {
      await markDelivered(orderId)
      showToast('Marked as delivered.')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDelivering(null)
    }
  }

  const isReady = tab === 'ready'
  const items = isReady ? readyOrders : todayDeliveries

  return (
    <div className="c-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Delivery</h3>
        </div>
        <div className="d-tabs">
          <button className={`d-tab ${isReady ? 'active' : ''}`} onClick={() => setTab('ready')}>
            Ready to Deliver <span className="d-tab-count">{readyOrders.length}</span>
          </button>
          <button className={`d-tab ${!isReady ? 'active' : ''}`} onClick={() => setTab('today')}>
            Today's Deliveries <span className="d-tab-count">{todayDeliveries.length}</span>
          </button>
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : items.length === 0 ? (
        <p className="c-empty">{isReady ? 'No orders ready for delivery.' : 'No deliveries today.'}</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>{isReady ? 'Ready since' : 'Delivered at'}</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(o => (
                <tr key={o.id}>
                  <td className="mono">{o.order_number}</td>
                  <td>
                    <div>{o.customers?.name}</div>
                    <div className="d-mobile">{o.customers?.mobile || ''}</div>
                  </td>
                  <td>
                    <div className="d-items">
                      {o.order_items?.slice(0, 2).map((item, i) => (
                        <div key={i} className="d-item-line">{item.garment_name} x{item.quantity}</div>
                      ))}
                      {o.order_items?.length > 2 && <div className="d-item-line">+{o.order_items.length - 2} more</div>}
                    </div>
                  </td>
                  <td className="d-total">Rs. {Number(o.total_amount).toFixed(0)}</td>
                  <td className="d-date">{isReady ? formatDate(o.ready_at) : formatDate(o.delivered_at)}</td>
                  <td>
                    {isReady ? (
                      <button
                        className="c-add-btn"
                        style={{ padding: '6px 16px', fontSize: 13 }}
                        onClick={() => handleDeliver(o.id)}
                        disabled={delivering === o.id}
                      >
                        {delivering === o.id ? '...' : 'Mark Delivered'}
                      </button>
                    ) : (
                      <span className="d-delivered-badge">✓ Delivered</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
