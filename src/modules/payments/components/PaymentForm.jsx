import { useState, useEffect, useRef } from 'react'
import { fetchCustomersForPayment } from '../api/paymentQueries'

const MODES = ['Cash', 'JazzCash', 'Card', 'Bank Transfer', 'Other']

export default function PaymentForm({ tenantId, onSave, onCancel }) {
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    fetchCustomersForPayment(tenantId).then(setCustomers).catch(e => setError(e.message))
    setTimeout(() => ref.current?.focus(), 100)
  }, [tenantId])

  const selected = customers.find(c => c.id === customerId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!customerId) { setError('Please select a customer.'); return }
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return }
    if (selected && Number(amount) > selected.unpaid) {
      const ok = window.confirm(`Amount (Rs. ${Number(amount).toFixed(0)}) exceeds customer's unpaid balance (Rs. ${Number(selected.unpaid).toFixed(0)}). Continue?`)
      if (!ok) return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        customer_id: customerId,
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
        <span className="c-form-label">Customer *</span>
        <select className="c-form-input" ref={ref} value={customerId} onChange={e => setCustomerId(e.target.value)}>
          <option value="">Select a customer…</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} — Rs.{Number(c.unpaid).toFixed(0)} unpaid
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: -8 }}>
          <strong>Total Amount:</strong> Rs. {Number(selected.total_orders).toFixed(0)}
          {' · '}<strong>Total Paid:</strong> Rs. {Number(selected.total_paid).toFixed(0)}
          {' · '}<strong>Balance:</strong> Rs. {Math.abs(Number(selected.balance)).toFixed(0)} {Number(selected.balance) > 0 ? 'due' : Number(selected.balance) < 0 ? 'excess' : ''}
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
