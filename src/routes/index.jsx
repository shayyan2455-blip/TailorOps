import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LandingPage from '../shared/components/LandingPage'
import DashboardLayout from '../shared/components/DashboardLayout'
import DashboardHome from '../modules/dashboard/DashboardHome'
import CustomersPage from '../modules/customers/CustomersPage'
import OrdersPage from '../modules/orders/OrdersPage'
import ProductionPage from '../modules/production/ProductionPage'
import TailorsPage from '../modules/tailors/TailorsPage'
import PaymentsPage from '../modules/payments/PaymentsPage'
import DeliveryPage from '../modules/delivery/DeliveryPage'
import ReportsPage from '../modules/reports/ReportsPage'
import SettingsPage from '../modules/settings/SettingsPage'
import LedgerPage from '../modules/ledger/LedgerPage'
import TailorPaymentsPage from '../modules/tailorPayments/TailorPaymentsPage'
import TailorLedgerPage from '../modules/tailorLedger/TailorLedgerPage'
import ExpensesPage from '../modules/expenses/ExpensesPage'
import ExpensePaymentsPage from '../modules/expensePayments/ExpensePaymentsPage'
import ExpenseLedgerPage from '../modules/expenseLedger/ExpenseLedgerPage'
import PendingApprovalPage from '../modules/status/PendingApprovalPage'
import RejectedPage from '../modules/status/RejectedPage'
import SuspendedPage from '../modules/status/SuspendedPage'
import AdminLoginPage from '../modules/admin/AdminLoginPage'
import AdminLayout from '../modules/admin/AdminLayout'
import MetricsPage from '../modules/admin/MetricsPage'
import PendingApprovalsPage from '../modules/admin/PendingApprovalsPage'
import AllShopsPage from '../modules/admin/AllShopsPage'
import ShopDetailPage from '../modules/admin/ShopDetailPage'
import AuditLogPage from '../modules/admin/AuditLogPage'

function TenantStatusGuard({ children }) {
  const { user, tenantStatus, loading, isAdmin } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/" replace />

  if (!isAdmin && tenantStatus) {
    if (tenantStatus.status === 'pending') {
      return <Navigate to="/pending-approval" replace />
    }
    if (tenantStatus.status === 'rejected') {
      return <Navigate to="/rejected" replace />
    }
    if (tenantStatus.status === 'suspended') {
      return <Navigate to="/suspended" replace />
    }
  }

  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/pending-approval" element={<PendingApprovalPage />} />
      <Route path="/rejected" element={<RejectedPage />} />
      <Route path="/suspended" element={<SuspendedPage />} />

      <Route path="/dashboard" element={
        <TenantStatusGuard>
          <DashboardLayout />
        </TenantStatusGuard>
      }>
        <Route index element={<DashboardHome />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="production" element={<ProductionPage />} />
        <Route path="tailors" element={<TailorsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="delivery" element={<DeliveryPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="tailor-payments" element={<TailorPaymentsPage />} />
        <Route path="tailor-ledger" element={<TailorLedgerPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="expense-payments" element={<ExpensePaymentsPage />} />
        <Route path="expense-ledger" element={<ExpenseLedgerPage />} />
      </Route>

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<MetricsPage />} />
        <Route path="pending" element={<PendingApprovalsPage />} />
        <Route path="shops" element={<AllShopsPage />} />
        <Route path="shops/:tenantId" element={<ShopDetailPage />} />
        <Route path="audit" element={<AuditLogPage />} />
      </Route>
    </Routes>
  )
}
