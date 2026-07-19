import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchTailorPayments, recordTailorPayment, deleteTailorPayment } from './api/tailorPaymentQueries'
import TailorPaymentForm from './components/TailorPaymentForm'
import TailorReceiptView from './components/TailorReceiptView'
import ConfirmModal from '../../shared/components/ConfirmModal'

export default function TailorPaymentsPage() {
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
      const data = await fetchTailorPayments()
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
      const result = await recordTailorPayment(tenantId, payload)
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
      await deleteTailorPayment(id)
      showToast('Payment deleted.')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
    setConfirmDelete(null)
  }

  const handleReceipt = (payment) => {
    if (!payment.id) {
      showToast('Receipt not available.', 'error')
      return
    }
    setReceiptData({ paymentId: payment.id })
  }

  return (
    <div className="c-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Tailor Payments</h3>
          <button className="c-add-btn" onClick={() => setShowForm(true)}>+ Record Payment</button>
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : payments.length === 0 ? (
        <p className="c-empty">No tailor payments recorded yet.</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead>
              <tr>
                <th>Tailor</th>
                <th>Invoice #</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Mode</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.tailors?.name || '—'}</td>
                    <td className="mono">{p.invoice_number || '—'}</td>
                    <td className="pmt-amount">Rs. {Number(p.amount).toFixed(0)}</td>
                    <td>{p.payment_date}</td>
                    <td><span className="pmt-mode">{p.payment_mode}</span></td>
                    <td style={{ fontSize: 13, opacity: 0.6 }}>{p.notes || '—'}</td>
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
            <TailorPaymentForm onSave={handleSave} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}

      {receiptData && (
        <TailorReceiptView
          paymentId={receiptData.paymentId}
          onClose={() => setReceiptData(null)}
        />
      )}

      {confirmDelete !== null && (
        <ConfirmModal message="Delete this tailor payment?" onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}
