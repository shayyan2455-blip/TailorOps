import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../shared/hooks/useTheme'
import { useTableLabels } from '../../shared/hooks/useTableLabels'
import './TailorLayout.css'

const navItems = [
  { label: 'My Work', path: '/tailor' },
  { label: 'My History', path: '/tailor/history' },
  { label: 'My Earnings', path: '/tailor/earnings' },
]

export default function TailorLayout() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

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
          <span className="t-brand-tag" />
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
        </div>
        <Outlet />
      </main>
    </div>
  )
}
