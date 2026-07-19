import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './AuthModal.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(fields, mode) {
  const errors = {}
  for (const [key, val] of Object.entries(fields)) {
    if (!val || !val.trim()) {
      errors[key] = 'This field is required'
    }
  }
  if (fields.email && !EMAIL_RE.test(fields.email)) {
    errors.email = 'Enter a valid email address'
  }
  if (fields.password && fields.password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
  }
  if (mode === 'create' && fields.confirmPassword && fields.password !== fields.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }
  return errors
}

export default function AuthModal({ open, onClose, initialMode }) {
  const [mode, setMode] = useState(initialMode || 'signin')
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const backdropRef = useRef(null)
  const firstInput = useRef(null)

  const [form, setForm] = useState({
    shopName: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    if (open) {
      setMode(initialMode || 'signin')
      setForm({ shopName: '', ownerName: '', email: '', password: '', confirmPassword: '' })
      setErrors({})
      setServerError('')
      setSubmitting(false)
      setShowPassword(false)
      setTimeout(() => firstInput.current?.focus(), 100)
    }
  }, [open, initialMode])

  useEffect(() => {
    setErrors({})
    setServerError('')
  }, [mode])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
  }

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) onClose()
  }

  const update = (key) => (e) => {
    setForm(p => ({ ...p, [key]: e.target.value }))
    if (errors[key]) setErrors(p => { const n = { ...p }; delete n[key]; return n })
  }

  const canSubmit = () => {
    const v = validate(form, mode)
    return Object.keys(v).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const v = validate(form, mode)
    setErrors(v)
    if (Object.keys(v).length > 0) return

    setSubmitting(true)
    setServerError('')

    try {
      if (mode === 'signin') {
        await signIn(form.email, form.password)
      } else {
        await signUp(form.email, form.password, form.shopName, form.ownerName)
      }
      onClose()
      navigate('/dashboard')
    } catch (err) {
      setServerError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = (m) => {
    setMode(m)
    setForm({ shopName: '', ownerName: '', email: '', password: '', confirmPassword: '' })
    setShowPassword(false)
  }

  if (!open) return null

  const isSignIn = mode === 'signin'

  return (
    <div className="auth-backdrop" ref={backdropRef} onClick={handleBackdropClick} onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label={isSignIn ? 'Sign in' : 'Create shop account'}>
        <button className="auth-close" onClick={onClose} aria-label="Close modal">&times;</button>

        <div className="auth-tabs">
          <button className={`auth-tab ${isSignIn ? 'active' : ''}`} onClick={() => switchMode('signin')}>Sign In</button>
          <button className={`auth-tab ${!isSignIn ? 'active' : ''}`} onClick={() => switchMode('create')}>Create Account</button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {!isSignIn && (
            <>
              <label className="auth-field">
                <span className="auth-label">Shop name</span>
                <input className="auth-input" value={form.shopName} onChange={update('shopName')} placeholder="e.g. Your shop's name" ref={firstInput} />
                {errors.shopName && <span className="auth-error">{errors.shopName}</span>}
              </label>
              <label className="auth-field">
                <span className="auth-label">Owner name</span>
                <input className="auth-input" value={form.ownerName} onChange={update('ownerName')} placeholder="Your full name" />
                {errors.ownerName && <span className="auth-error">{errors.ownerName}</span>}
              </label>
            </>
          )}

          <label className="auth-field">
            <span className="auth-label">Email</span>
            <input className="auth-input" type="email" value={form.email} onChange={update('email')} placeholder="you@yourshop.com" autoComplete="email" />
            {errors.email && <span className="auth-error">{errors.email}</span>}
          </label>

          <label className="auth-field">
            <span className="auth-label">Password</span>
            <div className="auth-pw-wrap">
              <input className="auth-input" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update('password')} placeholder={isSignIn ? 'Enter your password' : 'Min 6 characters'} autoComplete={isSignIn ? 'current-password' : 'new-password'} />
              {!isSignIn && (
                <button type="button" className="auth-eye" onClick={() => setShowPassword(v => !v)} tabIndex={-1} aria-label="Toggle password visibility">
                  {showPassword ? '🙈' : '👁'}
                </button>
              )}
            </div>
            {errors.password && <span className="auth-error">{errors.password}</span>}
          </label>

          {!isSignIn && (
            <label className="auth-field">
              <span className="auth-label">Confirm password</span>
              <input className="auth-input" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={update('confirmPassword')} placeholder="Repeat password" autoComplete="new-password" />
              {errors.confirmPassword && <span className="auth-error">{errors.confirmPassword}</span>}
            </label>
          )}

          <label className="auth-show-pw">
            <input type="checkbox" checked={showPassword} onChange={() => setShowPassword(v => !v)} />
            <span>Show {isSignIn ? 'password' : 'passwords'}</span>
          </label>

          {serverError && <div className="auth-server-error">{serverError}</div>}

          <button className="auth-submit" type="submit" disabled={submitting || !canSubmit()}>
            {submitting ? (
              <span className="auth-spinner" />
            ) : isSignIn ? (
              'Sign In'
            ) : (
              'Create Shop Account'
            )}
          </button>

          {isSignIn && (
            <a href="#" className="auth-forgot" onClick={(e) => e.preventDefault()}>Forgot password?</a>
          )}
        </form>

        <p className="auth-switch">
          {isSignIn ? (
            <>Don't have a shop yet? <button className="auth-link" onClick={() => switchMode('create')}>Create one</button></>
          ) : (
            <>Already have a shop? <button className="auth-link" onClick={() => switchMode('signin')}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  )
}
