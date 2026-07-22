import { useState, useEffect } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../shared/hooks/useTheme'
import { useTableLabels } from '../../shared/hooks/useTableLabels'
import { TopbarProvider, useTopbar } from '../../shared/context/TopbarContext'
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

function LayoutInner() {
  const { user, profile, loading, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const { title, action } = useTopbar()

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  useTableLabels('table, .tp-table, .admin-table', [location.pathname])

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

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
            <svg className="scissor-logo" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="30" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12.5 12.5L30 30" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M27.5 12.5L10 30" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="20" cy="20" r="2" fill="currentColor" stroke="currentColor" strokeWidth="1" />
            </svg>
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

export default function DashboardLayout() {
  return (
    <TopbarProvider>
      <LayoutInner />
    </TopbarProvider>
  )
}
