import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../shared/hooks/useTheme'
import './DashboardLayout.css'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Reports', path: '/dashboard/reports' },
    ],
  },
  {
    label: 'Workflow',
    items: [
      { label: 'Orders', path: '/dashboard/orders' },
      { label: 'Production', path: '/dashboard/production' },
      { label: 'Delivery', path: '/dashboard/delivery' },
    ],
  },
  {
    label: 'Records',
    items: [
      { label: 'Customers', path: '/dashboard/customers' },
      { label: 'Tailors', path: '/dashboard/tailors' },
      { label: 'Payments', path: '/dashboard/payments' },
      { label: 'Tailor Payments', path: '/dashboard/tailor-payments' },
      { label: 'Customer Ledger', path: '/dashboard/ledger' },
      { label: 'Tailor Ledger', path: '/dashboard/tailor-ledger' },
      { label: 'Settings', path: '/dashboard/settings' },
    ],
  },
]

export default function DashboardLayout() {
  const { user, profile, loading, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SO'

  const handleSignOut = async () => {
    try { await signOut() } catch {}
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div className="brand">
            <span className="brand-tag" />
            TailorOps
          </div>

          {navGroups.map(group => (
            <div key={group.label} className="nav-group">
              <div className="nav-label">{group.label}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="nav-dot" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-foot">
          <div className="foot-shop">{profile?.full_name || 'Shop Owner'}</div>
          <div className="foot-role">Owner</div>
          <div className="foot-actions">
            <button className="foot-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>
            <button className="foot-btn foot-signout" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
