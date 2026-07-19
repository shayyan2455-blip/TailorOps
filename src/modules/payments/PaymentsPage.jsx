import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchPayments, distributePayment, deletePayment, fetchCustomerWithOrders } from './api/paymentQueries'
import PaymentForm from './components/PaymentForm'
import ReceiptView from './components/ReceiptView'
import ConfirmModal from '../../shared/components/ConfirmModal'
import './PaymentsPage.css'

export default function PaymentsPage() {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchPayments()
      setPayments(data)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const handleSave = async (payload) => {
    try {
      const result = await distributePayment(tenantId, payload)
      showToast('Payment recorded.')
      setShowForm(false)
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      await deletePayment(id)
      showToast('Payment deleted.')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
    setConfirmDelete(null)
  }

  const handleReceipt = async (payment) => {
    try {
      const data = await fetchCustomerWithOrders(payment.orders?.customer_id)
      setReceiptData({ payment, customer: data.customer, orders: data.orders })
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const grouped = {}
  payments.forEach(p => {
    const cid = p.orders?.customer_id || 'unknown'
    if (!grouped[cid]) {
      grouped[cid] = {
        customer_name: p.orders?.customers?.name || 'Unknown',
        customer_id: cid,
        payments: [],
        total: 0,
      }
    }
    grouped[cid].payments.push(p)
    grouped[cid].total += Number(p.amount)
  })

  return (
    <div className="c-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Payments</h3>
          <button className="c-add-btn" onClick={() => setShowForm(true)}>+ Record Payment</button>
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : payments.length === 0 ? (
        <p className="c-empty">No payments recorded yet.</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Invoice #</th>
                <th>Order</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Mode</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td>{p.orders?.customers?.name || '—'}</td>
                  <td className="mono">{p.invoice_number || '—'}</td>
                  <td className="mono">{p.orders?.order_number || '—'}</td>
                  <td className="pmt-amount">Rs. {Number(p.amount).toFixed(0)}</td>
                  <td>{p.payment_date}</td>
                  <td><span className="pmt-mode">{p.payment_mode}</span></td>
                  <td className="c-actions">
                    <button className="c-action-btn" onClick={() => handleReceipt(p)}>Receipt</button>
                    <button className="c-action-btn c-action-destructive" onClick={() => setConfirmDelete(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="c-backdrop" onClick={() => setShowForm(false)}>
          <div className="c-form-modal" onClick={e => e.stopPropagation()}>
            <PaymentForm tenantId={tenantId} onSave={handleSave} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}

      {receiptData && (
        <ReceiptView
          payment={receiptData.payment}
          customer={receiptData.customer}
          orders={receiptData.orders}
          onClose={() => setReceiptData(null)}
        />
      )}

      {confirmDelete !== null && (
        <ConfirmModal message="Delete this payment?" onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}
