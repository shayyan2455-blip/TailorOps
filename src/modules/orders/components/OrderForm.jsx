import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { fetchCustomers } from '../../customers/api/customerQueries'
import { fetchMeasurementsByCustomer } from '../../measurements/api/measurementQueries'
import MeasurementForm from '../../measurements/components/MeasurementForm'

const EMPTY_ITEM = { garment_name: '', quantity: 1, rate: 0, amount: 0 }

export default function OrderForm({ order, onSave, onCancel }) {
  const { tenantId } = useAuth()
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [measData, setMeasData] = useState({})
  const [advancePayment, setAdvancePayment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const firstRef = useRef(null)

  useEffect(() => {
    fetchCustomers().then(setCustomers).catch(() => {})
  }, [])

  useEffect(() => {
    if (order) {
      setCustomerId(order.customer_id)
      setItems(order.order_items?.map(i => ({ garment_name: i.garment_name, quantity: i.quantity, rate: Number(i.rate), amount: Number(i.amount) })) || [{ ...EMPTY_ITEM }])
      setDeliveryDate(order.delivery_date || '')
      setNotes(order.notes || '')
      if (order.measurements?.length) setMeasData(order.measurements[0].data || {})
    }
    setTimeout(() => firstRef.current?.focus(), 100)
  }, [order])

  const loadMeasurements = useCallback(async (cId) => {
    if (!cId) { setMeasData({}); return }
    try {
      const m = await fetchMeasurementsByCustomer(cId)
      if (m.length) setMeasData(m[0].data)
    } catch {}
  }, [])

  const handleCustomerChange = (e) => {
    const val = e.target.value
    setCustomerId(val)
    if (val && !order) loadMeasurements(val)
  }

  const totalAmount = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)

  const updateItem = (idx, field) => (e) => {
    const val = field === 'garment_name' ? e.target.value : Number(e.target.value) || 0
    setItems(prev => {
      const next = prev.map((item, i) => i === idx ? { ...item, [field]: val } : item)
      if (field === 'quantity' || field === 'rate') {
        next[idx].amount = Number(next[idx].quantity) * Number(next[idx].rate)
      }
      return next
    })
  }

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!customerId) { setError('Please select a customer.'); return }
    if (items.length === 0 || !items[0].garment_name) { setError('Add at least one order item.'); return }

    setSaving(true)
    setError('')
    try {
      const pmt = Number(advancePayment) || 0
      await onSave({
        customer_id: customerId,
        total_amount: totalAmount,
        delivery_date: deliveryDate || null,
        notes,
        items: items.filter(i => i.garment_name),
        measurements: Object.keys(measData).length > 0 ? measData : null,
        advance_payment: pmt > 0 ? pmt : 0,
      })
    } catch (err) {
      setError(err.message || 'Failed to save order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="c-form" onSubmit={handleSubmit}>
      <h3 className="c-form-title">{order ? 'Edit Order' : 'New Order'}</h3>

      <label className="c-form-field">
        <span className="c-form-label">Customer *</span>
        <select className="c-form-input" ref={firstRef} value={customerId} onChange={handleCustomerChange}>
          <option value="">Select a customer…</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.mobile ? `(${c.mobile})` : ''}</option>)}
        </select>
      </label>

      <div className="c-form-field">
        <span className="c-form-label">Order Items</span>
        {items.map((item, i) => (
          <div key={i} className="o-item-row">
            <input className="c-form-input o-item-name" value={item.garment_name} onChange={updateItem(i, 'garment_name')} placeholder="Garment" />
            <input className="c-form-input o-item-qty" type="number" min="1" value={item.quantity} onChange={updateItem(i, 'quantity')} />
            <input className="c-form-input o-item-rate" type="number" min="0" step="0.01" value={item.rate} onChange={updateItem(i, 'rate')} placeholder="Rate" />
            <span className="o-item-amount">{(Number(item.amount) || 0).toFixed(0)}</span>
            {items.length > 1 && <button type="button" className="o-item-remove" onClick={() => removeItem(i)}>&times;</button>}
          </div>
        ))}
        <button type="button" className="o-item-add" onClick={addItem}>+ Add item</button>
      </div>

      <div className="c-form-field">
        <span className="c-form-label o-total-label">Total</span>
        <span className="o-total-amount">Rs. {totalAmount.toFixed(0)}</span>
      </div>

      <label className="c-form-field">
        <span className="c-form-label">Delivery date</span>
        <input className="c-form-input" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
      </label>

      <label className="c-form-field">
        <span className="c-form-label">Notes</span>
        <textarea className="c-form-input c-form-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
      </label>

      {!order && (
        <details className="c-form-field" style={{ cursor: 'pointer' }}>
          <summary className="c-form-label" style={{ cursor: 'pointer', userSelect: 'none' }}>Advance Payment</summary>
          <div style={{ marginTop: 8 }}>
            <input className="c-form-input" type="number" min="0" step="0.01" value={advancePayment} onChange={e => setAdvancePayment(e.target.value)} placeholder="0 — no payment" />
          </div>
        </details>
      )}

      <MeasurementForm data={measData} onChange={setMeasData} />

      {error && <div className="c-form-error">{error}</div>}

      <div className="c-form-actions">
        <button type="button" className="c-form-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="c-form-save" disabled={saving}>
          {saving ? 'Saving...' : order ? 'Update Order' : 'Create Order'}
        </button>
      </div>
    </form>
  )
}
