import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabaseClient'

const ADMIN_EMAIL = 'admin@tailorops.com'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const ref = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email === ADMIN_EMAIL) {
        navigate('/admin', { replace: true })
      }
    })
    setTimeout(() => ref.current?.focus(), 100)
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (email !== ADMIN_EMAIL) {
      setError('Access denied. This portal is for platform administrators only.')
      return
    }
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
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
      <form onSubmit={handleSubmit} style={{
        width: '100%',
        maxWidth: 380,
        background: 'var(--second-bg-color)',
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        padding: '32px 28px',
      }}>
        <div style={{
          fontFamily: "'Fraunces', serif",
          fontSize: 22,
          fontWeight: 500,
          marginBottom: 4,
        }}>
          Admin Portal
        </div>
        <div style={{
          fontSize: 13,
          opacity: 0.4,
          marginBottom: 24,
          fontFamily: "'IBM Plex Mono', monospace",
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Platform administration
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>Email</span>
          <input
            ref={ref}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@tailorops.com"
            autoComplete="email"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-color)',
              color: 'var(--text-color)',
              fontSize: 14,
              fontFamily: "'IBM Plex Sans', sans-serif",
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--main-color)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-color)',
              color: 'var(--text-color)',
              fontSize: 14,
              fontFamily: "'IBM Plex Sans', sans-serif",
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--main-color)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          />
        </div>

        {error && (
          <div style={{
            background: 'color-mix(in srgb, #e53e3e 10%, transparent)',
            border: '1px solid color-mix(in srgb, #e53e3e 30%, transparent)',
            color: '#e53e3e',
            fontSize: 13,
            padding: '10px 14px',
            borderRadius: 8,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          style={{
            width: '100%',
            padding: '12px',
            border: 'none',
            borderRadius: 24,
            background: 'var(--main-color)',
            color: 'white',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "'IBM Plex Sans', sans-serif",
            cursor: 'pointer',
            opacity: loading || !email || !password ? 0.4 : 1,
            transition: 'opacity 0.15s',
          }}
          onMouseOver={e => { if (!loading && email && password) e.currentTarget.style.opacity = '0.9' }}
          onMouseOut={e => { if (!loading && email && password) e.currentTarget.style.opacity = '1' }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
