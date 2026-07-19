import { useState, useEffect, useRef } from 'react'
import { fetchOrders } from '../../orders/api/orderQueries'

const MODES = ['Cash', 'JazzCash', 'Card', 'Bank Transfer', 'Other']

export default function PaymentForm({ tenantId, onSave, onCancel }) {
  const [orders, setOrders] = useState([])
  const [orderId, setOrderId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    fetchOrders().then(setOrders).catch(() => {})
    setTimeout(() => ref.current?.focus(), 100)
  }, [])

  const selectedOrder = orders.find(o => o.id === orderId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!orderId) { setError('Please select an order.'); return }
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        order_id: orderId,
        amount: Number(amount),
        payment_date: paymentDate,
        payment_mode: paymentMode,
        notes: notes.trim() || null,
      })
    } catch (err) {
      setError(err.message || 'Failed to record payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="c-form" onSubmit={handleSubmit}>
      <h3 className="c-form-title">Record Payment</h3>

      <label className="c-form-field">
        <span className="c-form-label">Order *</span>
        <select className="c-form-input" ref={ref} value={orderId} onChange={e => setOrderId(e.target.value)}>
          <option value="">Select an order…</option>
          {orders.map(o => (
            <option key={o.id} value={o.id}>
              {o.order_number} — {o.customers?.name || '?'} — Rs.{Number(o.total_amount).toFixed(0)}
            </option>
          ))}
        </select>
      </label>

      {selectedOrder && (
        <div className="pmt-balance">
          <span>Total: <strong>Rs.{Number(selectedOrder.total_amount).toFixed(0)}</strong></span>
        </div>
      )}

      <label className="c-form-field">
        <span className="c-form-label">Amount *</span>
        <input className="c-form-input" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
      </label>

      <label className="c-form-field">
        <span className="c-form-label">Date</span>
        <input className="c-form-input" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
      </label>

      <label className="c-form-field">
        <span className="c-form-label">Payment mode</span>
        <select className="c-form-input" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
          {MODES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      <label className="c-form-field">
        <span className="c-form-label">Notes</span>
        <input className="c-form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note" />
      </label>

      {error && <div className="c-form-error">{error}</div>}

      <div className="c-form-actions">
        <button type="button" className="c-form-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="c-form-save" disabled={saving}>
          {saving ? 'Saving...' : 'Record Payment'}
        </button>
      </div>
    </form>
  )
}
