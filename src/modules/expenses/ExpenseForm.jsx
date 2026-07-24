import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { recordExpensePayment } from '../expensePayments/api/expensePaymentQueries'
import ExpenseReceiptView from '../expensePayments/components/ExpenseReceiptView'

const MODES = ['Cash', 'JazzCash', 'Card', 'Bank Transfer', 'Other']

export default function ExpenseForm({ initial, onSave, onCancel }) {
  const { tenantId } = useAuth()
  const [description, setDescription] = useState(initial?.description || '')
  const [payeeName, setPayeeName] = useState(initial?.payee_name || '')
  const [totalAmount, setTotalAmount] = useState(initial?.total_amount?.toString() || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  const [savedExpense, setSavedExpense] = useState(initial)

  const [showPayment, setShowPayment] = useState(false)
  const [pmtAmount, setPmtAmount] = useState('')
  const [pmtDate, setPmtDate] = useState(new Date().toISOString().slice(0, 10))
  const [pmtMode, setPmtMode] = useState('Cash')
  const [pmtNotes, setPmtNotes] = useState('')
  const [pmtSaving, setPmtSaving] = useState(false)
  const [pmtError, setPmtError] = useState('')
  const [pmtReceiptId, setPmtReceiptId] = useState(null)

  useEffect(() => { setTimeout(() => ref.current?.focus(), 100) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!description.trim()) { setError('Enter a description.'); return }
    if (!payeeName.trim()) { setError('Enter the payee name.'); return }
    if (!totalAmount || Number(totalAmount) <= 0) { setError('Enter a valid total amount.'); return }
    setSaving(true)
    setError('')
    try {
      const result = await onSave({
        description: description.trim(),
        payee_name: payeeName.trim(),
        total_amount: Number(totalAmount),
        amount_paid: initial?.amount_paid || 0,
        credit: initial?.credit || 0,
      })
      if (result && result.id) {
        setSavedExpense(result)
      }
    } catch (err) {
      setError(err.message || 'Failed to save expense.')
    } finally {
      setSaving(false)
    }
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    const expenseId = savedExpense?.id || initial?.id
    if (!expenseId) return
    const amt = Number(pmtAmount)
    if (!amt || amt <= 0) { setPmtError('Enter a valid amount.'); return }
    setPmtSaving(true)
    setPmtError('')
    try {
      const result = await recordExpensePayment(tenantId, {
        expense_id: expenseId,
        amount: amt,
        payment_date: pmtDate,
        payment_mode: pmtMode,
        notes: pmtNotes,
      })
      const r = result?.[0]
      if (r?.payment_id) {
        setPmtReceiptId(r.payment_id)
      }
      setPmtAmount('')
      setPmtNotes('')
      setShowPayment(false)
    } catch (err) {
      setPmtError(err.message || 'Failed to record payment.')
    } finally {
      setPmtSaving(false)
    }
  }

  const activeExpense = savedExpense || initial

  return (
    <form className="c-form" onSubmit={handleSubmit}>
      <h3 className="c-form-title">{activeExpense ? 'Edit Expense' : 'New Expense'}</h3>

      <label className="c-form-field">
        <span className="c-form-label">Description *</span>
        <input className="c-form-input" ref={ref} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Fabric purchase" />
      </label>

      <label className="c-form-field">
        <span className="c-form-label">Payee Name *</span>
        <input className="c-form-input" value={payeeName} onChange={e => setPayeeName(e.target.value)} placeholder="Individual or organization name" />
      </label>

      <label className="c-form-field">
        <span className="c-form-label">Total Amount *</span>
        <input className="c-form-input" type="number" min="0" step="0.01" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} placeholder="0.00" />
      </label>

      {activeExpense && (
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Paid: <strong>Rs. {Number(activeExpense.amount_paid).toFixed(0)}</strong>
          {Number(activeExpense.credit) > 0 && <span> · Credit: <strong style={{ color: 'var(--success)' }}>Rs. {Number(activeExpense.credit).toFixed(0)}</strong></span>}
        </div>
      )}

      {error && <div className="c-form-error">{error}</div>}

      <div className="c-form-actions">
        <button type="button" className="c-form-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="c-form-save" disabled={saving}>
          {saving ? 'Saving...' : activeExpense ? 'Update' : 'Create Expense'}
        </button>
      </div>

      {activeExpense && (
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
        <ExpenseReceiptView
          paymentId={pmtReceiptId}
          onClose={() => setPmtReceiptId(null)}
        />
      )}
    </form>
  )
}
