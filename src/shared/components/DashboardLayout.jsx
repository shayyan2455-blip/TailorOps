import { useState, useEffect } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../shared/hooks/useTheme'
import { useTableLabels } from '../../shared/hooks/useTableLabels'
import './DashboardLayout.css'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Reports', path: '/dashboard/reports' },
      { label: 'Settings', path: '/dashboard/settings' },
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
    label: 'Customers',
    items: [
      { label: 'Customers', path: '/dashboard/customers' },
      { label: 'Customer Payments', path: '/dashboard/payments' },
      { label: 'Customer Ledger', path: '/dashboard/ledger' },
    ],
  },
  {
    label: 'Tailor',
    items: [
      { label: 'Tailors', path: '/dashboard/tailors' },
      { label: 'Tailor Payments', path: '/dashboard/tailor-payments' },
      { label: 'Tailor Ledger', path: '/dashboard/tailor-ledger' },
    ],
  },
  {
    label: 'Expenses',
    items: [
      { label: 'Expenses', path: '/dashboard/expenses' },
      { label: 'Expense Payments', path: '/dashboard/expense-payments' },
      { label: 'Expense Ledger', path: '/dashboard/expense-ledger' },
    ],
  },
]

export default function DashboardLayout() {
  const { user, profile, loading, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  useTableLabels('table, .tp-table, .admin-table', [location.pathname])

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SO'

  const handleSignOut = async () => {
    try { await signOut() } catch {}
    setMenuOpen(false)
  }

  return (
    <div className="shell">
      <div className={`mobile-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />

      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
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
          <div className="foot-role">{profile?.role || 'Owner'}</div>
          <div className="foot-actions">
            <button className="foot-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>
            <button className="foot-btn foot-signout" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      </aside>

      <main className="main">
        <button className="menu-toggle" onClick={() => setMenuOpen(p => !p)} aria-label="Toggle menu">
          <span className="menu-bar" /><span className="menu-bar" /><span className="menu-bar" />
        </button>
        <Outlet />
      </main>
    </div>
  )
}
