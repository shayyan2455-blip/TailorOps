import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchPayments, distributePayment, deletePayment, fetchPaymentForReceipt } from './api/paymentQueries'
import { fetchTenant } from '../settings/api/settingsQueries'
import PaymentForm from './components/PaymentForm'
import ReceiptView from './components/ReceiptView'
import { useTopbar } from '../../shared/context/TopbarContext'
import ConfirmModal from '../../shared/components/ConfirmModal'
import './PaymentsPage.css'

export default function PaymentsPage() {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const { setTopbar } = useTopbar()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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

  useEffect(() => {
    setTopbar('Customer Payments', <button className="c-add-btn" onClick={() => setShowForm(true)}>+ Record Payment</button>)
    return () => setTopbar('', null)
  }, [setTopbar])

  const handleSave = async (payload) => {
    try {
      const result = await distributePayment(tenantId, payload)
      showToast('Payment recorded.')
      setShowForm(false)
      load()
      if (result && result.length > 0 && result[0].payment_id) {
        setReceiptData({ paymentId: result[0].payment_id })
      }
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
    if (!payment.id) {
      showToast('Receipt not available.', 'error')
      return
    }
    setReceiptData({ paymentId: payment.id })
  }

  const filtered = payments.filter(p => {
    if (search) {
      const q = search.toLowerCase()
      const name = (p.customers?.name || p.orders?.customers?.name || '').toLowerCase()
      if (!name.includes(q)) return false
    }
    if (dateFrom && p.payment_date < dateFrom) return false
    if (dateTo && p.payment_date > dateTo) return false
    return true
  })

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
          <h3 className="c-title">Customer Payments</h3>
          <button className="c-add-btn" onClick={() => setShowForm(true)}>+ Record Payment</button>
        </div>
        <div className="c-header-row" style={{ marginTop: 8, gap: 8 }}>
          <input className="c-search" placeholder="Search by customer name…" value={search} onChange={e => setSearch(e.target.value)} />
          <input className="c-search" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
          <input className="c-search" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : payments.length === 0 ? (
        <p className="c-empty">No payments recorded yet.</p>
      ) : filtered.length === 0 ? (
        <p className="c-empty">No payments match your filters.</p>
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
              {filtered.map(p => {
                const customerName = p.customers?.name || p.orders?.customers?.name || '—'
                const orderNum = p.orders?.order_number || (p.order_id === null ? '—' : '—')
                const isCredit = p.order_id === null && p.payment_mode === 'Credit'
                return (
                  <tr key={p.id} className={isCredit ? 'pmt-credit-row' : ''}>
                    <td>{customerName}</td>
                    <td className="mono">{p.invoice_number || '—'}</td>
                    <td className="mono">{orderNum}{isCredit ? ' (credit)' : ''}</td>
                    <td className="pmt-amount">Rs. {Number(p.amount).toFixed(0)}</td>
                    <td>{p.payment_date}</td>
                    <td><span className="pmt-mode">{p.payment_mode}</span></td>
                    <td className="c-actions">
                      <button className="c-action-btn" onClick={() => handleReceipt(p)}>Receipt</button>
                      <button className="c-action-btn c-action-destructive" onClick={() => setConfirmDelete(p.id)}>Delete</button>
                    </td>
                  </tr>
                )
              })}
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
          paymentId={receiptData.paymentId}
          onClose={() => setReceiptData(null)}
        />
      )}

      {confirmDelete !== null && (
        <ConfirmModal message="Delete this payment?" onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}
