import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchTenant } from '../settings/api/settingsQueries'
import { fetchTailorPayments, recordTailorPayment, deleteTailorPayment } from './api/tailorPaymentQueries'
import TailorPaymentForm from './components/TailorPaymentForm'
import TailorReceiptView from './components/TailorReceiptView'
import { useTopbar } from '../../shared/context/TopbarContext'
import { formatDate } from '../../shared/lib/formatDate'
import ConfirmModal from '../../shared/components/ConfirmModal'

export default function TailorPaymentsPage() {
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
  const [tenant, setTenant] = useState(null)

  useEffect(() => {
    if (tenantId) fetchTenant(tenantId).then(setTenant).catch(() => {})
  }, [tenantId])

  const printPayments = () => {
    const currency = tenant?.currency || 'Rs.'
    const rows = filtered.map(p => `
      <tr>
        <td>${p.tailors?.name || '—'}</td>
        <td>${p.invoice_number || '—'}</td>
        <td class="num">${currency} ${Number(p.amount).toFixed(0)}</td>
        <td>${formatDate(p.payment_date)}</td>
        <td>${p.payment_mode || '—'}</td>
        <td>${p.notes || '—'}</td>
      </tr>`).join('')
    const total = filtered.reduce((s, p) => s + Number(p.amount), 0)

    const html = `<!DOCTYPE html>
<html><head><title>Tailor Payments</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12px; color: #111; }
  .identity { text-align: center; margin-bottom: 14px; }
  .shop-name { font-size: 20px; font-weight: 700; }
  .meta { font-size: 11px; color: #555; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 11px; }
  th { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; font-family: 'Courier New', monospace; }
  .num { text-align: right; font-family: 'Courier New', monospace; }
  .total { font-weight: 700; font-size: 13px; text-align: right; margin-top: 10px; }
  .footer { text-align: center; font-size: 10px; color: #666; margin-top: 16px; border-top: 1px solid #ccc; padding-top: 8px; }
</style></head>
<body>
  <div class="identity">
    <div class="shop-name">${tenant?.name || 'Tailor Shop'}</div>
    <div class="meta">Tailor Payments — ${filtered.length} payment${filtered.length !== 1 ? 's' : ''}</div>
  </div>
  <table>
    <thead><tr><th>Tailor</th><th>Invoice #</th><th class="num">Amount</th><th>Date</th><th>Mode</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total Paid: ${currency} ${total.toFixed(0)}</div>
  <div class="footer">Generated on ${formatDate(new Date().toISOString().slice(0, 10))} · TailorOps</div>
</body></html>`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none;'
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open(); doc.write(html); doc.close()
    iframe.contentWindow.focus()
    setTimeout(() => {
      try { iframe.contentWindow.print() } catch {}
      setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe) }, 1000)
    }, 300)
  }

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

  useEffect(() => {
    setTopbar('Tailor Payments', <button className="c-add-btn" onClick={() => setShowForm(true)}>+ Record Payment</button>)
    return () => setTopbar('', null)
  }, [setTopbar])

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

  const filtered = payments.filter(p => {
    if (search) {
      const q = search.toLowerCase()
      const name = (p.tailors?.name || '').toLowerCase()
      if (!name.includes(q)) return false
    }
    if (dateFrom && p.payment_date < dateFrom) return false
    if (dateTo && p.payment_date > dateTo) return false
    return true
  })

  return (
    <div className="c-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Tailor Payments</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="c-add-btn" onClick={printPayments}>Print PDF</button>
            <button className="c-add-btn" onClick={() => setShowForm(true)}>+ Record Payment</button>
          </div>
        </div>
        <div className="c-header-row" style={{ marginTop: 8, gap: 8 }}>
          <input className="c-search" placeholder="Search by tailor name…" value={search} onChange={e => setSearch(e.target.value)} />
          <input className="c-search" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
          <input className="c-search" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : payments.length === 0 ? (
        <p className="c-empty">No tailor payments recorded yet.</p>
      ) : filtered.length === 0 ? (
        <p className="c-empty">No tailor payments match your filters.</p>
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
              {filtered.map(p => (
                  <tr key={p.id}>
                    <td>{p.tailors?.name || '—'}</td>
                    <td className="mono">{p.invoice_number || '—'}</td>
                    <td className="pmt-amount">Rs. {Number(p.amount).toFixed(0)}</td>
                    <td>{formatDate(p.payment_date)}</td>
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
