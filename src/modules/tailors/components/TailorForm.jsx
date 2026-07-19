import { useState, useEffect, useRef } from 'react'

export default function TailorForm({ tailor, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (tailor) {
      setName(tailor.name)
      setMobile(tailor.mobile || '')
      setActive(tailor.active !== false)
    }
    setTimeout(() => ref.current?.focus(), 100)
  }, [tailor])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ name: name.trim(), mobile: mobile.trim(), active })
    } catch (err) {
      setError(err.message || 'Failed to save tailor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="c-form" onSubmit={handleSubmit}>
      <h3 className="c-form-title">{tailor ? 'Edit Tailor' : 'Add Tailor'}</h3>
      <label className="c-form-field">
        <span className="c-form-label">Name *</span>
        <input className="c-form-input" ref={ref} value={name} onChange={e => setName(e.target.value)} placeholder="Tailor name" />
      </label>
      <label className="c-form-field">
        <span className="c-form-label">Mobile</span>
        <input className="c-form-input" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="03XX-XXXXXXX" />
      </label>
      <label className="c-form-field c-form-check">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
        <span>Active</span>
      </label>
      {error && <div className="c-form-error">{error}</div>}
      <div className="c-form-actions">
        <button type="button" className="c-form-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="c-form-save" disabled={saving}>
          {saving ? 'Saving...' : tailor ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}
