import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function ForcedPasswordChangePage() {
  const { session, signOut } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changing, setChanging] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')

  const toggleStyle = {
    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
    fontSize: 13, padding: '4px 8px', fontFamily: "'IBM Plex Sans', sans-serif",
  }

  const handleChange = async () => {
    setError('')
    if (!newPassword) { setError('Enter a new password'); return }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }

    setChanging(true)
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, accessToken: session?.access_token }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to change password')

      // Force a clean re-auth rather than patching local state —
      // guarantees AuthContext re-resolves with must_change_password: false
      await signOut()
      showToast('Password changed — please sign in again')
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setChanging(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg-color)',
    }}>
      <div style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--main-color) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--main-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 500, fontSize: 24, margin: '0 0 10px' }}>
            Set a new password
          </h1>
          <p style={{ opacity: 0.6, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            You're signing in with a temporary password. Choose a permanent one
            before continuing — you'll need to sign in again afterward.
          </p>
        </div>

        <div className="s-field">
          <label className="s-label">New Password</label>
          <div style={{ position: 'relative' }}>
            <input className="c-form-input" type={showNew ? 'text' : 'password'}
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 6 characters" style={{ width: '100%', paddingRight: 60 }} />
            <button style={toggleStyle} onClick={() => setShowNew(p => !p)} type="button">
              {showNew ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="s-field" style={{ marginTop: 14 }}>
          <label className="s-label">Confirm New Password</label>
          <input className="c-form-input" type="password"
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password" style={{ width: '100%' }} />
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</p>
        )}

        <button
          className="c-form-save"
          onClick={handleChange}
          disabled={changing || !newPassword}
          style={{ width: '100%', marginTop: 20, padding: '12px 0' }}
        >
          {changing ? 'Changing...' : 'Change Password & Sign In Again'}
        </button>
      </div>
    </div>
  )
}