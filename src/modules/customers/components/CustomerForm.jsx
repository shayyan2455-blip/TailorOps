import { useState, useEffect, useRef } from 'react'

export default function CustomerForm({ customer, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const firstRef = useRef(null)

  useEffect(() => {
    if (customer) {
      setName(customer.name)
      setMobile(customer.mobile || '')
      setAddress(customer.address || '')
    }
    setTimeout(() => firstRef.current?.focus(), 100)
  }, [customer])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ name: name.trim(), mobile: mobile.trim(), address: address.trim() })
    } catch (err) {
      setError(err.message || 'Failed to save customer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="c-form" onSubmit={handleSubmit}>
      <h3 className="c-form-title">{customer ? 'Edit Customer' : 'Add Customer'}</h3>
      <label className="c-form-field">
        <span className="c-form-label">Name *</span>
        <input className="c-form-input" ref={firstRef} value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" />
      </label>
      <label className="c-form-field">
        <span className="c-form-label">Mobile</span>
        <input className="c-form-input" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="03XX-XXXXXXX" />
      </label>
      <label className="c-form-field">
        <span className="c-form-label">Address</span>
        <textarea className="c-form-input c-form-textarea" value={address} onChange={e => setAddress(e.target.value)} placeholder="Shop address" rows={3} />
      </label>
      {error && <div className="c-form-error">{error}</div>}
      <div className="c-form-actions">
        <button type="button" className="c-form-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="c-form-save" disabled={saving}>
          {saving ? 'Saving...' : customer ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}
