import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { fetchPayments, createPayment, deletePayment, fetchBalance } from './api/paymentQueries'
import { fetchOrder } from '../orders/api/orderQueries'
import PaymentForm from './components/PaymentForm'
import ReceiptView from './components/ReceiptView'
import './PaymentsPage.css'

export default function PaymentsPage() {
  const { tenantId } = useAuth()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [receipt, setReceipt] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchPayments()
      setPayments(data)
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (payload) => {
    await createPayment(tenantId, payload)
    setShowForm(false)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this payment?')) return
    await deletePayment(id)
    load()
  }

  const handleReceipt = async (payment) => {
    const order = await fetchOrder(payment.order_id)
    const balance = await fetchBalance(payment.order_id)
    setReceipt({ payment, order, balance })
  }

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
                <th>Order</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Mode</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="mono">{p.orders?.order_number || '—'}</td>
                  <td>{p.orders?.customers?.name || '—'}</td>
                  <td className="pmt-amount">Rs. {Number(p.amount).toFixed(0)}</td>
                  <td>{p.payment_date}</td>
                  <td><span className="pmt-mode">{p.payment_mode}</span></td>
                  <td className="c-actions">
                    <button className="c-action-btn" onClick={() => handleReceipt(p)}>Receipt</button>
                    <button className="c-action-btn c-action-destructive" onClick={() => handleDelete(p.id)}>Delete</button>
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

      {receipt && (
        <ReceiptView
          payment={receipt.payment}
          order={receipt.order}
          balance={receipt.balance}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  )
}
