import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import './DashboardLayout.css'

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '◉' },
  { label: 'Customers', path: '/dashboard/customers', icon: '◎' },
  { label: 'Orders', path: '/dashboard/orders', icon: '◈' },
  { label: 'Production', path: '/dashboard/production', icon: '▤' },
  { label: 'Tailors', path: '/dashboard/tailors', icon: '◐' },
  { label: 'Payments', path: '/dashboard/payments', icon: '₨' },
  { label: 'Delivery', path: '/dashboard/delivery', icon: '◫' },
  { label: 'Reports', path: '/dashboard/reports', icon: '▦' },
]

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`dash ${collapsed ? 'dash--collapsed' : ''}`}>
      <aside className="dash-sidebar">
        <div className="dash-sidebar-header">
          <div className="dash-logo">
            <span className="dash-logo-tag" />
            {!collapsed && <span>TailorOps</span>}
          </div>
          <button className="dash-collapse-btn" onClick={() => setCollapsed(v => !v)}>
            {collapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="dash-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) => `dash-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="dash-nav-icon">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="dash-sidebar-footer">
          <div className="dash-user">
            <div className="dash-avatar" />
            {!collapsed && <span className="dash-user-name">Shop Owner</span>}
          </div>
        </div>
      </aside>
      <main className="dash-main">
        <header className="dash-topbar">
          <h2 className="dash-page-title">Dashboard</h2>
          <div className="dash-topbar-right">
            <a href="/" className="dash-back-link">← Back to site</a>
          </div>
        </header>
        <div className="dash-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
