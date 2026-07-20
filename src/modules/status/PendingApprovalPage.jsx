import { useAuth } from '../../context/AuthContext'

export default function PendingApprovalPage() {
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
      <div style={{
        maxWidth: 440,
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56,
          borderRadius: '50%',
          background: 'color-mix(in srgb, var(--main-color) 15%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 28,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--main-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 500,
          fontSize: 28,
          margin: '0 0 12px',
        }}>
          Awaiting Approval
        </h1>
        <p style={{
          opacity: 0.6,
          fontSize: 15,
          lineHeight: 1.6,
          margin: '0 0 32px',
        }}>
          Your shop registration has been received and is currently being reviewed.
          You'll receive an email once it's approved. This usually takes less than 24 hours.
        </p>
        <div style={{
          background: 'var(--second-bg-color)',
          borderRadius: 12,
          padding: '16px 20px',
          fontSize: 13,
          opacity: 0.5,
          marginBottom: 32,
        }}>
          <strong>What happens next?</strong>
          <br />
          Our team will review your application. Once approved, you'll be able to
          sign in and start using TailorOps. We'll send you an email at the address
          you registered with.
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
