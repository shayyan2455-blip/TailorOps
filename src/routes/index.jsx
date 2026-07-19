import { Routes, Route } from 'react-router-dom'
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

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
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
      </Route>
    </Routes>
  )
}
