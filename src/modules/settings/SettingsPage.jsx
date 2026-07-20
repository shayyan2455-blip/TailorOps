import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchTenant, updateTenant } from './api/settingsQueries'
import TeamPage from './TeamPage'
import './SettingsPage.css'

const TABS = ['Shop Settings', 'Team']

export default function SettingsPage() {
  const { tenantId, profile, role } = useAuth()
  const { showToast } = useToast()
  const [tab, setTab] = useState('Shop Settings')
  const [form, setForm] = useState({ name: '', address: '', phone: '', currency: 'Rs.', receipt_footer: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    setLoading(true)
    fetchTenant(tenantId)
      .then(data => setForm({
        name: data.name || '',
        address: data.address || '',
        phone: data.phone || '',
        currency: data.currency || 'Rs.',
        receipt_footer: data.receipt_footer || '',
      }))
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [tenantId, showToast])

  const handleChange = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateTenant(tenantId, form)
      showToast('Settings saved.')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="c-module"><p className="c-empty">Loading settings...</p></div>

  return (
    <div className="c-module">
      <header className="c-header">
        <h3 className="c-title">Settings</h3>
        <span className="s-owner">{profile?.full_name || '—'} ({role})</span>
      </header>

      <div className="s-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`s-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Shop Settings' && (
        <div className="s-form">
          <div className="s-field">
            <label className="s-label">Shop Name</label>
            <input className="c-form-input" value={form.name} onChange={handleChange('name')} placeholder="Your shop name" />
          </div>

          <div className="s-field">
            <label className="s-label">Address</label>
            <textarea className="c-form-input s-textarea" value={form.address} onChange={handleChange('address')} placeholder="Shop address" rows={3} />
          </div>

          <div className="s-field">
            <label className="s-label">Phone</label>
            <input className="c-form-input" value={form.phone} onChange={handleChange('phone')} placeholder="Phone number" />
          </div>

          <div className="s-field">
            <label className="s-label">Currency Symbol</label>
            <input className="c-form-input" style={{ maxWidth: 120 }} value={form.currency} onChange={handleChange('currency')} placeholder="Rs." />
          </div>

          <div className="s-field">
            <label className="s-label">Receipt Footer</label>
            <textarea className="c-form-input s-textarea" value={form.receipt_footer} onChange={handleChange('receipt_footer')} placeholder="Thank you! — shown at the bottom of receipts" rows={2} />
          </div>

          <button className="c-add-btn" onClick={handleSave} disabled={saving} style={{ marginTop: 8, padding: '10px 32px' }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {tab === 'Team' && <TeamPage />}
    </div>
  )
}
