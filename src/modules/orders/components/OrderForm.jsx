import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { fetchCustomers } from '../../customers/api/customerQueries'
import { fetchMeasurementsByCustomer } from '../../measurements/api/measurementQueries'
import { recordOrderPayment } from '../../orders/api/orderQueries'
import ReceiptView from '../../../modules/payments/components/ReceiptView'
import MeasurementForm from '../../measurements/components/MeasurementForm'

const EMPTY_ITEM = { garment_name: '', quantity: 1, rate: 0, amount: 0 }
const MODES = ['Cash', 'JazzCash', 'Card', 'Bank Transfer', 'Other']

export default function OrderForm({ order, onSave, onCancel }) {
  const { tenantId } = useAuth()
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [measData, setMeasData] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const firstRef = useRef(null)

  const [savedOrder, setSavedOrder] = useState(order)

  const [showPayment, setShowPayment] = useState(false)
  const [pmtAmount, setPmtAmount] = useState('')
  const [pmtDate, setPmtDate] = useState(new Date().toISOString().slice(0, 10))
  const [pmtMode, setPmtMode] = useState('Cash')
  const [pmtNotes, setPmtNotes] = useState('')
  const [pmtSaving, setPmtSaving] = useState(false)
  const [pmtError, setPmtError] = useState('')
  const [pmtReceiptId, setPmtReceiptId] = useState(null)

  useEffect(() => {
    fetchCustomers().then(setCustomers).catch(() => {})
  }, [])

  useEffect(() => {
    const target = savedOrder || order
    if (target) {
      setCustomerId(target.customer_id)
      setItems(target.order_items?.map(i => ({ garment_name: i.garment_name, quantity: i.quantity, rate: Number(i.rate), amount: Number(i.amount) })) || [{ ...EMPTY_ITEM }])
      setDeliveryDate(target.delivery_date || '')
      setNotes(target.notes || '')
      if (target.measurements?.length) setMeasData(target.measurements[0].data || {})
    }
    setTimeout(() => firstRef.current?.focus(), 100)
  }, [order, savedOrder])

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
    if (val && !order && !savedOrder) loadMeasurements(val)
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
      const result = await onSave({
        customer_id: customerId,
        total_amount: totalAmount,
        delivery_date: deliveryDate || null,
        notes,
        items: items.filter(i => i.garment_name),
        measurements: Object.keys(measData).length > 0 ? measData : null,
      })
      if (result && result.id) {
        setSavedOrder(result)
      }
    } catch (err) {
      setError(err.message || 'Failed to save order.')
    } finally {
      setSaving(false)
    }
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    const orderId = savedOrder?.id || order?.id
    if (!orderId) return
    const amt = Number(pmtAmount)
    if (!amt || amt <= 0) { setPmtError('Enter a valid amount.'); return }
    setPmtSaving(true)
    setPmtError('')
    try {
      const paymentId = await recordOrderPayment(tenantId, {
        order_id: orderId,
        amount: amt,
        payment_date: pmtDate,
        payment_mode: pmtMode,
        notes: pmtNotes,
      })
      setPmtReceiptId(paymentId)
      setPmtAmount('')
      setPmtNotes('')
      setShowPayment(false)
    } catch (err) {
      setPmtError(err.message || 'Failed to record payment.')
    } finally {
      setPmtSaving(false)
    }
  }

  const activeOrder = savedOrder || order

  return (
    <form className="c-form" onSubmit={handleSubmit}>
      <h3 className="c-form-title">{activeOrder ? 'Edit Order' : 'New Order'}</h3>

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

      <MeasurementForm data={measData} onChange={setMeasData} />

      {error && <div className="c-form-error">{error}</div>}

      <div className="c-form-actions">
        <button type="button" className="c-form-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="c-form-save" disabled={saving}>
          {saving ? 'Saving...' : activeOrder ? 'Update Order' : 'Create Order'}
        </button>
      </div>

      {activeOrder && (
        <div className="c-form-field" style={{ marginTop: 12 }}>
          {!showPayment ? (
            <button type="button" className="c-form-save" style={{ width: '100%' }} onClick={() => setShowPayment(true)}>+ Add a Payment</button>
          ) : (
            <div style={{ background: 'var(--card-bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <span className="c-form-label">Record Payment</span>
              <label className="c-form-field" style={{ marginTop: 8 }}>
                <span className="c-form-label">Amount</span>
                <input className="c-form-input" type="number" min="0" step="0.01" value={pmtAmount} onChange={e => setPmtAmount(e.target.value)} placeholder="0.00" />
              </label>
              <label className="c-form-field">
                <span className="c-form-label">Date</span>
                <input className="c-form-input" type="date" value={pmtDate} onChange={e => setPmtDate(e.target.value)} />
              </label>
              <label className="c-form-field">
                <span className="c-form-label">Mode</span>
                <select className="c-form-input" value={pmtMode} onChange={e => setPmtMode(e.target.value)}>
                  {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="c-form-field">
                <span className="c-form-label">Notes (optional)</span>
                <input className="c-form-input" value={pmtNotes} onChange={e => setPmtNotes(e.target.value)} placeholder="optional" />
              </label>
              {pmtError && <div className="c-form-error">{pmtError}</div>}
              <div className="c-form-actions" style={{ marginTop: 8 }}>
                <button type="button" className="c-form-cancel" onClick={() => { setShowPayment(false); setPmtError('') }}>Cancel</button>
                <button type="button" className="c-form-save" onClick={handlePayment} disabled={pmtSaving}>
                  {pmtSaving ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {pmtReceiptId && (
        <ReceiptView
          paymentId={pmtReceiptId}
          onClose={() => setPmtReceiptId(null)}
        />
      )}
    </form>
  )
}
