import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { fetchExpensesForPayment } from '../api/expensePaymentQueries'

const MODES = ['Cash', 'JazzCash', 'Card', 'Bank Transfer', 'Other']

export default function ExpensePaymentForm({ onSave, onCancel }) {
  const { tenantId } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [expenseId, setExpenseId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    fetchExpensesForPayment(tenantId).then(setExpenses).catch(e => setError(e.message))
    setTimeout(() => ref.current?.focus(), 100)
  }, [tenantId])

  const selected = expenses.find(e => e.id === expenseId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!expenseId) { setError('Please select an expense.'); return }
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return }
    if (selected && Number(amount) > Math.max(0, selected.balance)) {
      const ok = window.confirm(`Amount (Rs. ${Number(amount).toFixed(0)}) exceeds the expense balance (Rs. ${Math.max(0, selected.balance).toFixed(0)}). Excess will become credit. Continue?`)
      if (!ok) return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        expense_id: expenseId,
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
      <h3 className="c-form-title">Record Expense Payment</h3>

      <label className="c-form-field">
        <span className="c-form-label">Expense *</span>
        <select className="c-form-input" ref={ref} value={expenseId} onChange={e => setExpenseId(e.target.value)}>
          <option value="">Select an expense…</option>
          {expenses.map(e => (
            <option key={e.id} value={e.id}>
              {e.description} ({e.payee_name}) — Rs.{Number(e.balance).toFixed(0)} due
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: -8 }}>
          Balance: <strong>Rs. {Math.max(0, selected.balance).toFixed(0)}</strong>
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
