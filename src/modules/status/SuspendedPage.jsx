import { useAuth } from '../../context/AuthContext'

export default function SuspendedPage() {
  const { signOut } = useAuth()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'var(--bg-color)',
    }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56,
          borderRadius: '50%',
          background: 'color-mix(in srgb, #e53e3e 15%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 500,
          fontSize: 28,
          margin: '0 0 12px',
        }}>
          Shop Suspended
        </h1>
        <p style={{
          opacity: 0.6,
          fontSize: 15,
          lineHeight: 1.6,
          margin: '0 0 24px',
        }}>
          Your shop has been suspended. You no longer have access to the
          dashboard until this is resolved.
        </p>
        <div style={{
          background: 'var(--second-bg-color)',
          borderRadius: 12,
          padding: '16px 20px',
          fontSize: 13,
          opacity: 0.5,
          marginBottom: 32,
          textAlign: 'left',
        }}>
          <strong>Need help?</strong>
          <br />
          Please contact support at{' '}
          <a href="mailto:support@tailorops.com" style={{ color: 'var(--main-color)', textDecoration: 'underline' }}>
            support@tailorops.com
          </a>
          {' '}for assistance.
        </div>
        <button
          onClick={signOut}
          style={{
            background: 'none',
            border: '1px solid color-mix(in srgb, var(--text-color) 20%, transparent)',
            color: 'var(--text-color)',
            padding: '10px 24px',
            borderRadius: 20,
            fontSize: 14,
            fontFamily: "'IBM Plex Sans', sans-serif",
            cursor: 'pointer',
            opacity: 0.6,
            transition: 'opacity 0.15s',
          }}
          onMouseOver={e => e.currentTarget.style.opacity = '1'}
          onMouseOut={e => e.currentTarget.style.opacity = '0.6'}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
