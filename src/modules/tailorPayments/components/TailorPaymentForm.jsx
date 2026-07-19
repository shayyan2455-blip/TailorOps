import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { fetchTailorsForPayment } from '../api/tailorPaymentQueries'

const MODES = ['Cash', 'JazzCash', 'Card', 'Bank Transfer', 'Other']

export default function TailorPaymentForm({ onSave, onCancel }) {
  const { tenantId } = useAuth()
  const [tailors, setTailors] = useState([])
  const [tailorId, setTailorId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    fetchTailorsForPayment(tenantId).then(setTailors).catch(e => setError(e.message))
    setTimeout(() => ref.current?.focus(), 100)
  }, [tenantId])

  const selected = tailors.find(t => t.id === tailorId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!tailorId) { setError('Please select a tailor.'); return }
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return }
    if (selected && Number(amount) > Math.max(0, selected.balance)) {
      const ok = window.confirm(`Amount (Rs. ${Number(amount).toFixed(0)}) exceeds tailor's outstanding balance (Rs. ${Math.max(0, selected.balance).toFixed(0)}). Excess will become credit. Continue?`)
      if (!ok) return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        tailor_id: tailorId,
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
      <h3 className="c-form-title">Record Payment to Tailor</h3>

      <label className="c-form-field">
        <span className="c-form-label">Tailor *</span>
        <select className="c-form-input" ref={ref} value={tailorId} onChange={e => setTailorId(e.target.value)}>
          <option value="">Select a tailor…</option>
          {tailors.map(t => (
            <option key={t.id} value={t.id}>{t.name}{t.mobile ? ` — ${t.mobile}` : ''}</option>
          ))}
        </select>
      </label>

      {selected && (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: -8 }}>
          Outstanding: <strong>Rs. {Math.max(0, selected.balance).toFixed(0)}</strong>
          {selected.credit > 0 && <span> · Credit: <strong style={{ color: 'var(--success)' }}>Rs. {Number(selected.credit).toFixed(0)}</strong></span>}
          — excess payment becomes credit
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
