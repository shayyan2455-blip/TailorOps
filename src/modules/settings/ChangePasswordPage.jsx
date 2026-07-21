import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function ChangePasswordPage() {
  const { session } = useAuth()
  const { showToast } = useToast()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changing, setChanging] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const toggleStyle = {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
    fontSize: 13, padding: '4px 8px', fontFamily: "'IBM Plex Sans', sans-serif",
  }

  const handleChange = async () => {
    if (!newPassword) { showToast('Enter a new password', 'error'); return }
    if (newPassword.length < 6) { showToast('Password must be at least 6 characters', 'error'); return }
    if (newPassword !== confirmPassword) { showToast('Passwords do not match', 'error'); return }

    setChanging(true)
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, accessToken: session?.access_token }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to change password')
      showToast('Password changed successfully')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="s-form">
      <div className="s-field">
        <label className="s-label">New Password</label>
        <div style={{ position: 'relative' }}>
          <input className="c-form-input" type={showNew ? 'text' : 'password'}
            value={newPassword} onChange={e => setNewPassword(e.target.value)}
            placeholder="At least 6 characters" style={{ width: '100%', paddingRight: 60 }} />
          <button style={toggleStyle} onClick={() => setShowNew(p => !p)}>
            {showNew ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className="s-field">
        <label className="s-label">Confirm New Password</label>
        <input className="c-form-input" type="password"
          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Re-enter new password" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button className="c-form-save" onClick={handleChange} disabled={changing || !newPassword}>
          {changing ? 'Changing...' : 'Change Password'}
        </button>
      </div>
    </div>
  )
}
