import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useTopbar } from '../../shared/context/TopbarContext'
import { formatDate } from '../../shared/lib/formatDate'
import { supabase } from '../../shared/lib/supabaseClient'
import { fetchOrders, createOrder, updateOrder, deleteOrder } from './api/orderQueries'
import { saveMeasurement } from '../measurements/api/measurementQueries'
import OrderForm from './components/OrderForm'
import ConfirmModal from '../../shared/components/ConfirmModal'
import './OrdersPage.css'

const STAGES = ['', 'Booked', 'Cutting', 'Stitching', 'Ready', 'Delivered']

export default function OrdersPage() {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const { setTopbar } = useTopbar()
  const [orders, setOrders] = useState([])
  const [stageFilter, setStageFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchOrders({
        stage: stageFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      })
      setOrders(data)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [stageFilter, dateFrom, dateTo, search, showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setTopbar('Orders', <button className="c-add-btn" onClick={() => { setEditing(null); setShowForm(true) }}>+ New Order</button>)
    return () => setTopbar('', null)
  }, [setTopbar])

  const handleSave = async (payload) => {
    try {
      const { items, measurements, ...orderData } = payload

      if (editing) {
        await updateOrder(editing.id, orderData)

        if (items) {
          await supabase.from('order_items').delete().eq('order_id', editing.id)
          if (items.length > 0) {
            await supabase.from('order_items').insert(
              items.map(i => ({ ...i, tenant_id: tenantId, order_id: editing.id }))
            )
          }
        }

        if (measurements) {
          await saveMeasurement(tenantId, orderData.customer_id, editing.id, measurements)
        }

        showToast('Order updated.')
      } else {
        const { data: orderNum, error: numErr } = await supabase.rpc('generate_order_number', { p_tenant_id: tenantId })
        if (numErr) throw new Error(numErr.message)
        if (!orderNum) throw new Error('generate_order_number returned null')

        const { id: orderId } = await createOrder(tenantId, {
          ...orderData,
          order_number: orderNum,
        })

        if (items?.length > 0) {
          await supabase.from('order_items').insert(
            items.map(i => ({ ...i, tenant_id: tenantId, order_id: orderId }))
          )
        }

        if (measurements) {
          await saveMeasurement(tenantId, orderData.customer_id, orderId, measurements)
        }

        const { data: creditApplied } = await supabase.rpc('apply_customer_credit', {
          p_customer_id: orderData.customer_id,
          p_order_id: orderId,
          p_tenant_id: tenantId,
        })
        if (creditApplied && Number(creditApplied) > 0) {
          showToast(`Order created. Rs. ${Number(creditApplied).toFixed(0)} credit auto-applied from overpayment.`)
        } else {
          showToast('Order created.')
        }
      }

      setShowForm(false)
      setEditing(null)
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteOrder(id)
      showToast('Order deleted.')
      if (detail?.id === id) setDetail(null)
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
    setConfirmDelete(null)
  }

  const stageLabel = (s) => {
    const map = { Booked: 'BOOKED', Cutting: 'CUTTING', Stitching: 'STITCHING', Ready: 'READY', Delivered: 'DELIVERED' }
    return map[s] || s
  }

  return (
    <div className="c-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Orders</h3>
          <button className="c-add-btn" onClick={() => { setEditing(null); setShowForm(true) }}>+ New Order</button>
        </div>
        <div className="o-filters">
          <input className="c-search o-filter-item" placeholder="Search by order# or customer name…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="c-form-input o-filter-item" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
            <option value="">All stages</option>
            {STAGES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="c-form-input o-filter-item" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" />
          <input className="c-form-input o-filter-item" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" />
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="c-empty">{search || stageFilter || dateFrom ? 'No orders match your filters.' : 'No orders yet. Create your first one.'}</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Stage</th>
                <th>Total</th>
                <th>Delivery</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className={detail?.id === o.id ? 'row-active' : ''}>
                  <td>
                    <button className="c-name-link" onClick={() => setDetail(detail?.id === o.id ? null : o)}>
                      {o.order_number}
                    </button>
                  </td>
                  <td>{o.customers?.name || '—'}</td>
                  <td><span className={`o-stage o-stage--${o.current_stage?.toLowerCase()}`}>{stageLabel(o.current_stage)}</span></td>
                  <td>Rs. {Number(o.total_amount).toFixed(0)}</td>
                  <td>{formatDate(o.delivery_date)}</td>
                  <td className="c-actions">
                    <button className="c-action-btn" onClick={() => { setEditing(o); setShowForm(true) }}>Edit</button>
                    <button className="c-action-btn c-action-destructive" onClick={() => setConfirmDelete(o.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="c-detail">
          <div className="c-detail-row">
            <div><span className="c-detail-label">Order #</span><span>{detail.order_number}</span></div>
            <div><span className="c-detail-label">Customer</span><span>{detail.customers?.name}</span></div>
            <div><span className="c-detail-label">Stage</span><span>{detail.current_stage}</span></div>
            <div><span className="c-detail-label">Total</span><span>Rs. {Number(detail.total_amount).toFixed(0)}</span></div>
            <div><span className="c-detail-label">Delivery</span><span>{formatDate(detail.delivery_date)}</span></div>
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

      {showForm && (
        <div className="c-backdrop" onClick={() => { setShowForm(false); setEditing(null) }}>
          <div className="c-form-modal o-form-modal" onClick={e => e.stopPropagation()}>
            <OrderForm
              order={editing}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null) }}
            />
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <ConfirmModal message="Delete this order?" onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}
