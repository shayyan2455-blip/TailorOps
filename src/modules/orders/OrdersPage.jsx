import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useTopbar } from '../../shared/context/TopbarContext'
import { formatDate } from '../../shared/lib/formatDate'
import { fetchTenant } from '../settings/api/settingsQueries'
import { supabase } from '../../shared/lib/supabaseClient'
import { fetchOrders, createOrder, updateOrder, deleteOrder } from './api/orderQueries'
import { saveMeasurement } from '../measurements/api/measurementQueries'
import OrderForm from './components/OrderForm'
import InvoiceView from './components/InvoiceView'
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
  const [invoiceOrderId, setInvoiceOrderId] = useState(null)
  const [tenant, setTenant] = useState(null)

  useEffect(() => {
    if (tenantId) fetchTenant(tenantId).then(setTenant).catch(() => {})
  }, [tenantId])

  const printOrders = () => {
    const currency = tenant?.currency || 'Rs.'
    const rows = orders.map(o => `
      <tr>
        <td>${o.order_number || '—'}</td>
        <td>${o.customers?.name || '—'}</td>
        <td>${o.current_stage || '—'}</td>
        <td class="num">${currency} ${Number(o.total_amount).toFixed(0)}</td>
        <td class="num">${o.delivery_date ? formatDate(o.delivery_date) : '—'}</td>
      </tr>`).join('')

    const total = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0)

    const html = `<!DOCTYPE html>
<html><head><title>Orders Summary</title>
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
  .total { font-weight: 700; font-size: 13px; text-align: right; margin-top: 10px; }
  .footer { text-align: center; font-size: 10px; color: #666; margin-top: 16px; border-top: 1px solid #ccc; padding-top: 8px; }
</style></head>
<body>
  <div class="identity">
    <div class="shop-name">${tenant?.name || 'Tailor Shop'}</div>
    <div class="meta">Orders Summary — ${orders.length} order${orders.length !== 1 ? 's' : ''}</div>
  </div>
  <table>
    <thead><tr><th>Order #</th><th>Customer</th><th>Stage</th><th class="num">Total</th><th class="num">Delivery</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total Amount: ${currency} ${total.toFixed(0)}</div>
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
    setTopbar('Orders', <><button className="c-add-btn" onClick={() => { setEditing(null); setShowForm(true) }}>+ New Order</button><button className="c-add-btn" style={{ marginLeft: 8 }} onClick={printOrders}>Print PDF</button></>)
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
        setShowForm(false)
        setEditing(null)
        load()
        return null
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

        load()
        return { id: orderId, customer_id: orderData.customer_id, total_amount: orderData.total_amount, order_number: orderNum }
      }
    } catch (err) {
      showToast(err.message, 'error')
      throw err
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
                    <button className="c-action-btn" onClick={() => setInvoiceOrderId(o.id)}>Invoice</button>
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

      {invoiceOrderId && (
        <InvoiceView orderId={invoiceOrderId} onClose={() => setInvoiceOrderId(null)} />
      )}
    </div>
  )
}
