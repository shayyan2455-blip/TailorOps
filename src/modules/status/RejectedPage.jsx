import { useAuth } from '../../context/AuthContext'

export default function RejectedPage() {
  const { signOut, tenantStatus } = useAuth()
  const reason = tenantStatus?.rejection_reason

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
          background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M15 9l-6 6M9 9l6 6"/>
          </svg>
        </div>
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 500,
          fontSize: 28,
          margin: '0 0 12px',
        }}>
          Application Not Approved
        </h1>
        <p style={{
          opacity: 0.6,
          fontSize: 15,
          lineHeight: 1.6,
          margin: '0 0 24px',
        }}>
          Thank you for your interest in TailorOps. Unfortunately, your shop
          registration was not approved at this time.
        </p>
        {reason && (
          <div style={{
            background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--danger) 20%, transparent)',
            borderRadius: 12,
            padding: '16px 20px',
            fontSize: 14,
            textAlign: 'left',
            marginBottom: 24,
          }}>
            <div style={{ fontWeight: 500, marginBottom: 4, color: 'var(--danger)' }}>Reason:</div>
            <div style={{ opacity: 0.7 }}>{reason}</div>
          </div>
        )}
        <p style={{
          fontSize: 13,
          opacity: 0.5,
          marginBottom: 32,
        }}>
          If you believe this is a mistake, please contact our support team at{' '}
          <a href="mailto:support@tailorops.com" style={{ color: 'var(--main-color)', textDecoration: 'underline' }}>
            support@tailorops.com
          </a>
          .
        </p>
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
