import { useState, useEffect, useRef } from 'react'

export default function ExpenseForm({ initial, onSave, onCancel }) {
  const [description, setDescription] = useState(initial?.description || '')
  const [payeeName, setPayeeName] = useState(initial?.payee_name || '')
  const [totalAmount, setTotalAmount] = useState(initial?.total_amount?.toString() || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => { setTimeout(() => ref.current?.focus(), 100) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!description.trim()) { setError('Enter a description.'); return }
    if (!payeeName.trim()) { setError('Enter the payee name.'); return }
    if (!totalAmount || Number(totalAmount) <= 0) { setError('Enter a valid total amount.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        description: description.trim(),
        payee_name: payeeName.trim(),
        total_amount: Number(totalAmount),
        amount_paid: initial?.amount_paid || 0,
        credit: initial?.credit || 0,
      })
    } catch (err) {
      setError(err.message || 'Failed to save expense.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="c-form" onSubmit={handleSubmit}>
      <h3 className="c-form-title">{initial ? 'Edit Expense' : 'New Expense'}</h3>

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

      {initial && (
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Paid: <strong>Rs. {Number(initial.amount_paid).toFixed(0)}</strong>
          {Number(initial.credit) > 0 && <span> · Credit: <strong style={{ color: 'var(--success)' }}>Rs. {Number(initial.credit).toFixed(0)}</strong></span>}
        </div>
      )}

      {error && <div className="c-form-error">{error}</div>}

      <div className="c-form-actions">
        <button type="button" className="c-form-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="c-form-save" disabled={saving}>
          {saving ? 'Saving...' : initial ? 'Update' : 'Create Expense'}
        </button>
      </div>
    </form>
  )
}
