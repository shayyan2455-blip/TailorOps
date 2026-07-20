import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './TailorLayout.css'

const navItems = [
  { label: 'My Work', path: '/tailor' },
  { label: 'My History', path: '/tailor/history' },
  { label: 'My Earnings', path: '/tailor/earnings' },
]

export default function TailorLayout() {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    try { await signOut() } catch {}
  }

  return (
    <div className="t-shell">
      <aside className="t-sidebar">
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
          <button className="t-signout" onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>

      <main className="t-main">
        <Outlet />
      </main>
    </div>
  )
}
