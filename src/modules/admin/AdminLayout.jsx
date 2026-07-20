import { useEffect } from 'react'
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import './AdminLayout.css'

const ADMIN_EMAIL = 'liberaltech.official@gmail.com'

const navItems = [
  { label: 'Metrics', path: '/admin' },
  { label: 'Pending Approvals', path: '/admin/pending' },
  { label: 'All Shops', path: '/admin/shops' },
  { label: 'Audit Log', path: '/admin/audit' },
]

export default function AdminLayout() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) return null

  if (!user || user.email !== ADMIN_EMAIL) {
    return <Navigate to="/admin/login" replace />
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-tag" />
          TailorOps
          <span style={{ fontSize: 10, opacity: 0.35, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase', marginLeft: 'auto' }}>
            Admin
          </span>
        </div>

        <nav className="admin-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              className={({ isActive }) => `admin-nav-item${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-foot">
          <div style={{ fontSize: 12, opacity: 0.4, marginBottom: 8 }}>
            {user?.email}
          </div>
          <button className="admin-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
