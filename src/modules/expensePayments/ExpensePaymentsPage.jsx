import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchExpensePayments, recordExpensePayment, deleteExpensePayment } from './api/expensePaymentQueries'
import ExpensePaymentForm from './components/ExpensePaymentForm'
import ExpenseReceiptView from './components/ExpenseReceiptView'
import ConfirmModal from '../../shared/components/ConfirmModal'

export default function ExpensePaymentsPage() {
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
      const data = await fetchExpensePayments()
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
      const result = await recordExpensePayment(tenantId, payload)
      const r = result?.[0]
      if (r) {
        const msgs = []
        if (Number(r.applied_amount) > 0) msgs.push(`Rs. ${Number(r.applied_amount).toFixed(0)} applied`)
        if (Number(r.credit_stored) > 0) msgs.push(`Rs. ${Number(r.credit_stored).toFixed(0)} stored as credit`)
        showToast(msgs.length ? 'Payment recorded. ' + msgs.join(', ') + '.' : 'Payment recorded.')
      } else {
        showToast('Payment recorded.')
      }
      setShowForm(false)
      load()
      if (r?.payment_id) {
        setReceiptData({ paymentId: r.payment_id })
      }
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteExpensePayment(id)
      showToast('Payment deleted.')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
    setConfirmDelete(null)
  }

  const handleReceipt = (payment) => {
    if (!payment.id) { showToast('Receipt not available.', 'error'); return }
    setReceiptData({ paymentId: payment.id })
  }

  return (
    <div className="c-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Expense Payments</h3>
          <button className="c-add-btn" onClick={() => setShowForm(true)}>+ Record Payment</button>
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : payments.length === 0 ? (
        <p className="c-empty">No expense payments recorded yet.</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Expense</th>
                <th>Payee</th>
                <th className="l-num mono">Amount</th>
                <th>Date</th>
                <th>Mode</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="mono">{p.invoice_number || '—'}</td>
                  <td>{p.expenses?.description || '—'}</td>
                  <td>{p.expenses?.payee_name || '—'}</td>
                  <td className="l-num mono">Rs. {Number(p.amount).toFixed(0)}</td>
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
            <ExpensePaymentForm onSave={handleSave} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}

      {receiptData && (
        <ExpenseReceiptView
          paymentId={receiptData.paymentId}
          onClose={() => setReceiptData(null)}
        />
      )}

      {confirmDelete !== null && (
        <ConfirmModal message="Delete this expense payment?" onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}
