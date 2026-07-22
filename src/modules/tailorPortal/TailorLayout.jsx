import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../shared/hooks/useTheme'
import { useTableLabels } from '../../shared/hooks/useTableLabels'
import { TopbarProvider, useTopbar } from '../../shared/context/TopbarContext'
import './TailorLayout.css'

const navItems = [
  { label: 'My Work', path: '/tailor' },
  { label: 'My History', path: '/tailor/history' },
  { label: 'My Earnings', path: '/tailor/earnings' },
]

function TailorLayoutInner() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { title, action } = useTopbar()

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  useTableLabels('.tp-table', [location.pathname])

  const handleSignOut = async () => {
    try { await signOut() } catch {}
    setMenuOpen(false)
  }

  return (
    <div className="t-shell">
      <div className={`mobile-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />

      <aside className={`t-sidebar${menuOpen ? ' open' : ''}`}>
        <div className="t-brand">
          <svg className="scissor-logo" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="30" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12.5 12.5L30 30" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M27.5 12.5L10 30" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="20" cy="20" r="2" fill="currentColor" stroke="currentColor" strokeWidth="1" />
          </svg>
          TailorOps
        </div>

        <nav className="t-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/tailor'}
              className={({ isActive }) => `t-nav-item${isActive ? ' active' : ''}`}
            >
              <span className="t-nav-dot" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="t-foot">
          <div style={{ fontSize: 12, opacity: 0.4, marginBottom: 8 }}>
            {user?.email}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="t-signout" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button className="t-signout" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      </aside>

      <main className="t-main">
        <div className="mobile-topbar">
          <button className="menu-toggle" onClick={() => setMenuOpen(p => !p)} aria-label="Toggle menu">
            <span className="menu-bar" /><span className="menu-bar" /><span className="menu-bar" />
          </button>
          <span className="mobile-topbar-title">{title}</span>
          {action && <span className="mobile-topbar-action">{action}</span>}
        </div>
        <Outlet />
      </main>
    </div>
  )
}

export default function TailorLayout() {
  return (
    <TopbarProvider>
      <TailorLayoutInner />
    </TopbarProvider>
  )
}
