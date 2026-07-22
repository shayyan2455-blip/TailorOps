import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { fetchPaymentForReceipt } from '../api/paymentQueries'
import { fetchTenant } from '../../settings/api/settingsQueries'
import { useToast } from '../../../context/ToastContext'
import { formatDate } from '../../../shared/lib/formatDate'
import './ReceiptView.css'

const CloseX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const PrinterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
  </svg>
)

function todayStr() {
  return formatDate(new Date().toISOString().slice(0, 10))
}

export default function ReceiptView({ paymentId, onClose }) {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!paymentId || !tenantId) return
    setLoading(true)
    setError(null)
    Promise.all([
      fetchPaymentForReceipt(paymentId),
      fetchTenant(tenantId),
    ])
      .then(([receipt, tenant]) => setData({ ...receipt, tenant }))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [paymentId, tenantId])

  const receiptNumber = data?.payment?.id
    ? 'RCP-' + data.payment.id.replace(/-/g, '').slice(-8).toUpperCase()
    : 'RCP-????????'

  const buildPrintHtml = useCallback(() => {
    if (!data) return ''
    const { payment, tenant } = data
    const c = payment.customers || {}
    const o = payment.orders || {}
    const currency = tenant?.currency || 'Rs.'
    const balance = data.balance || 0
    const orderNum = o?.order_number || (payment.order_id === null ? '—' : '—')

    const amt = Number(payment.amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    const bal = Number(balance).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

    return `<!DOCTYPE html>
<html>
<head>
  <title>Receipt ${receiptNumber}</title>
  <style>
    @page { size: A5; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 13px;
      color: #111;
      background: #fff;
      line-height: 1.5;
      max-width: 420px;
      margin: 0 auto;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-top: 4px; }
    .header-left { font-size: 14px; font-weight: 700; color: #111; }
    .header-right { font-size: 11px; color: #555; font-family: 'Courier New', monospace; }
    .identity { text-align: center; padding: 8px 0 12px; }
    .shop-name { font-size: 22px; font-weight: 700; color: #111; letter-spacing: 0.01em; margin-bottom: 2px; }
    .receipt-id { font-size: 10px; color: #666; font-family: 'Courier New', monospace; margin-top: 4px; }
    hr { border: none; border-top: 1px solid #ccc; margin: 0; }
    .section { padding: 10px 0; }
    .section-title { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; margin-bottom: 6px; font-family: 'Courier New', monospace; }
    .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
    .row-label { color: #444; }
    .row-value { text-align: right; color: #111; }
    .amount-value { font-size: 18px; font-weight: 700; color: #000; }
    .direction { font-size: 12px; color: #555; text-align: right; }
    .balance { color: #c0392b; font-weight: 600; }
    .footer { text-align: center; font-size: 10px; color: #666; padding-top: 8px; border-top: 1px solid #ccc; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">Receipt</div>
    <div class="header-right">${receiptNumber}</div>
  </div>

  <div class="identity">
    <div class="shop-name">${tenant?.name || 'Tailor Shop'}</div>
    <div class="receipt-id">${receiptNumber}</div>
  </div>
  <hr />

  <div class="section">
    <div class="section-title">Party Details</div>
    <div class="row"><span class="row-label">Name</span><span class="row-value">${c?.name || '—'}</span></div>
    <div class="row"><span class="row-label">Phone</span><span class="row-value">${c?.mobile || '—'}</span></div>
    <div class="row"><span class="row-label">Address</span><span class="row-value">${c?.address || '—'}</span></div>
    <div class="row"><span class="row-label">Type</span><span class="row-value">Customer</span></div>
  </div>
  <hr />

  <div class="section">
    <div class="section-title">Payment Details</div>
    <div class="row"><span class="row-label">Amount</span><span class="row-value amount-value">${currency} ${amt}</span></div>
    <div class="row" style="justify-content:flex-end"><span class="direction">Received from customer</span></div>
    <div class="row"><span class="row-label">Method</span><span class="row-value">${payment.payment_mode || '—'}</span></div>
    <div class="row"><span class="row-label">Date</span><span class="row-value">${formatDate(payment.payment_date)}</span></div>
    <div class="row"><span class="row-label">Order</span><span class="row-value">${orderNum}</span></div>
    <div class="row"><span class="row-label">Balance remaining</span><span class="row-value balance">${currency} ${bal}</span></div>
  </div>

  ${tenant?.receipt_footer ? `<div class="footer">${tenant.receipt_footer}</div>` : ''}
  <div class="footer">Generated on ${todayStr()} &middot; TailorOps</div>
</body>
</html>`
  }, [data, receiptNumber])

  const handlePrint = () => {
    const html = buildPrintHtml()
    if (!html) return

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow.document
    doc.open()
    doc.write(html)
    doc.close()

    iframe.contentWindow.focus()
    setTimeout(() => {
      try {
        iframe.contentWindow.print()
      } catch (e) {
        showToast('Could not print. Try allowing popups for this site.', 'error')
      }
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      }, 1000)
    }, 300)
  }

  const c = data?.payment?.customers || {}
  const o = data?.payment?.orders || {}
  const currency = data?.tenant?.currency || 'Rs.'
  const balance = data?.balance || 0
  const orderNum = o?.order_number || (data?.payment?.order_id === null ? '—' : '—')

  return (
    <div className="r-backdrop" onClick={onClose}>
      <div className="r-modal" onClick={e => e.stopPropagation()}>

        {loading && <div className="r-loading">Loading receipt...</div>}

        {error && <div className="r-loading" style={{ color: 'var(--danger)' }}>{error}</div>}

        {data && !loading && (
          <>
            <div className="r-header">
              <div className="r-header-left">
                <button className="r-close-btn" onClick={onClose} aria-label="Close receipt"><CloseX /></button>
                <div>
                  <div className="r-header-title">Receipt</div>
                  <div className="r-header-num">{receiptNumber}</div>
                </div>
              </div>
              <button className="r-print-btn" onClick={handlePrint}><PrinterIcon /> Print / PDF</button>
            </div>

            <div className="r-body">
              <div className="r-identity">
                <div className="r-shop-name">{data?.tenant?.name || 'Tailor Shop'}</div>
                <div className="r-receipt-id">{receiptNumber}</div>
              </div>
              <hr className="r-divider" />

              <div className="r-section">
                <div className="r-section-title">Party Details</div>
                <div className="r-row"><span className="r-row-label">Name</span><span className="r-row-value">{c?.name || '—'}</span></div>
                <div className="r-row"><span className="r-row-label">Phone</span><span className="r-row-value">{c?.mobile || '—'}</span></div>
                <div className="r-row"><span className="r-row-label">Address</span><span className="r-row-value">{c?.address || '—'}</span></div>
                <div className="r-row"><span className="r-row-label">Type</span><span className="r-row-value">Customer</span></div>
              </div>
              <hr className="r-divider" />

              <div className="r-section">
                <div className="r-section-title">Payment Details</div>
                <div className="r-row">
                  <span className="r-row-label">Amount</span>
                  <span className="r-row-value r-amount-value">{currency} {Number(data?.payment?.amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div className="r-row" style={{ justifyContent: 'flex-end' }}>
                  <span className="r-direction">Received from customer</span>
                </div>
                <div className="r-row"><span className="r-row-label">Method</span><span className="r-row-value">{data?.payment?.payment_mode || '—'}</span></div>
                <div className="r-row"><span className="r-row-label">Date</span><span className="r-row-value">{formatDate(data?.payment?.payment_date)}</span></div>
                <div className="r-row"><span className="r-row-label">Order</span><span className="r-row-value">{orderNum}</span></div>
                <div className="r-row">
                  <span className="r-row-label">Balance remaining</span>
                  <span className="r-row-value r-balance-remaining">{currency} {Number(balance).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {data?.tenant?.receipt_footer && <div className="r-footer">{data.tenant.receipt_footer}</div>}
              <div className="r-footer">Generated on {todayStr()} · TailorOps</div>
            </div>

            <div className="r-close-bottom">
              <button className="r-close-bottom-btn" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
