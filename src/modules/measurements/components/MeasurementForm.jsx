import { useState, useEffect } from 'react'

const DEFAULT_FIELDS = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'shoulder', label: 'Shoulder' },
  { key: 'sleeve', label: 'Sleeve' },
  { key: 'length', label: 'Length' },
  { key: 'collar', label: 'Collar' },
  { key: 'inseam', label: 'Inseam' },
  { key: 'hip', label: 'Hip' },
  { key: 'bust', label: 'Bust' },
  { key: 'outseam', label: 'Outseam' },
]

export default function MeasurementForm({ data, onChange }) {
  const [fields, setFields] = useState([])

  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setFields(DEFAULT_FIELDS.map(f => ({ ...f, value: data[f.key] || '' })))
    } else {
      setFields(DEFAULT_FIELDS.map(f => ({ ...f, value: '' })))
    }
  }, [data])

  const update = (key) => (e) => {
    const next = fields.map(f => f.key === key ? { ...f, value: e.target.value } : f)
    setFields(next)
    const obj = {}
    next.forEach(f => { if (f.value) obj[f.key] = f.value })
    onChange(obj)
  }

  return (
    <div className="c-form-field">
      <span className="c-form-label">Measurements</span>
      <div className="meas-grid">
        {fields.map(f => (
          <label key={f.key} className="meas-field">
            <span className="meas-label">{f.label}</span>
            <input className="c-form-input" value={f.value} onChange={update(f.key)} placeholder="—" />
          </label>
        ))}
      </div>
    </div>
  )
}
