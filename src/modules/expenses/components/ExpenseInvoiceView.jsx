import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { fetchExpenseForInvoice } from '../api/expenseQueries'
import { fetchTenant } from '../../settings/api/settingsQueries'
import { useToast } from '../../../context/ToastContext'
import { formatDate } from '../../../shared/lib/formatDate'
import './ExpenseInvoiceView.css'

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

export default function ExpenseInvoiceView({ expenseId, onClose }) {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!expenseId || !tenantId) return
    setLoading(true)
    setError(null)
    Promise.all([
      fetchExpenseForInvoice(expenseId),
      fetchTenant(tenantId),
    ])
      .then(([invoice, tenant]) => setData({ ...invoice, tenant }))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [expenseId, tenantId])

  const invoiceNumber = data?.expense?.id
    ? 'EXP-' + data.expense.id.replace(/-/g, '').slice(-8).toUpperCase()
    : 'EXP-????????'

  const buildPrintHtml = useCallback(() => {
    if (!data) return ''
    const { expense, payments, balance, tenant } = data
    const currency = tenant?.currency || 'Rs.'

    const paymentsRows = (payments || []).map(p => `
      <div class="pmt-row">
        <span>${formatDate(p.payment_date)}</span>
        <span>${p.payment_mode || '—'}</span>
        <span>${currency} ${Number(p.amount).toFixed(0)}</span>
      </div>`).join('')

    const credit = Number(expense.credit || 0)

    return `<!DOCTYPE html>
<html>
<head>
  <title>Invoice ${invoiceNumber}</title>
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
    .inv-id { font-size: 10px; color: #666; font-family: 'Courier New', monospace; margin-top: 4px; }
    hr { border: none; border-top: 1px solid #ccc; margin: 0; }
    .section { padding: 10px 0; }
    .section-title { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; margin-bottom: 6px; font-family: 'Courier New', monospace; }
    .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
    .row-label { color: #444; }
    .row-value { text-align: right; color: #111; }
    .amount-value { font-size: 18px; font-weight: 700; color: #000; }
    .balance { color: #c0392b; font-weight: 600; }
    .credit { color: #27ae60; font-weight: 500; }
    .footer { text-align: center; font-size: 10px; color: #666; padding-top: 8px; border-top: 1px solid #ccc; margin-top: 8px; }
    .payments { margin-top: 6px; }
    .pmt-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0 2px 10px; color: #555; border-left: 2px solid #eee; }
    .pmt-row span:first-child { flex: 1; }
    .pmt-row span:nth-child(2) { margin: 0 12px; }
    .pmt-row span:last-child { text-align: right; font-weight: 500; color: #111; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">Expense Invoice</div>
    <div class="header-right">${invoiceNumber}</div>
  </div>

  <div class="identity">
    <div class="shop-name">${tenant?.name || 'Tailor Shop'}</div>
    <div class="inv-id">${invoiceNumber}</div>
  </div>
  <hr />

  <div class="section">
    <div class="section-title">Expense Details</div>
    <div class="row"><span class="row-label">Description</span><span class="row-value">${expense.description || '—'}</span></div>
    <div class="row"><span class="row-label">Payee Name</span><span class="row-value">${expense.payee_name || '—'}</span></div>
    <div class="row"><span class="row-label">Date Created</span><span class="row-value">${formatDate(expense.created_at)}</span></div>
  </div>
  <hr />

  <div class="section">
    <div class="section-title">Payment Summary</div>
    <div class="row"><span class="row-label">Total Amount</span><span class="row-value amount-value">${currency} ${Number(expense.amount).toFixed(0)}</span></div>
    <div class="row"><span class="row-label">Amount Paid</span><span class="row-value">${currency} ${Number(expense.amount_paid).toFixed(0)}</span></div>
    ${credit > 0 ? `<div class="row"><span class="row-label">Credit</span><span class="row-value credit">${currency} ${credit.toFixed(0)}</span></div>` : ''}
    <div class="row"><span class="row-label">Balance Remaining</span><span class="row-value balance">${currency} ${Number(balance).toFixed(0)}</span></div>
    ${payments.length > 0 ? `
    <div class="payments">
      <div class="section-title" style="margin-top:8px">Payments Made</div>
      ${paymentsRows}
    </div>` : ''}
  </div>

  ${tenant?.receipt_footer ? `<div class="footer">${tenant.receipt_footer}</div>` : ''}
  <div class="footer">Generated on ${todayStr()} &middot; TailorOps</div>
</body>
</html>`
  }, [data, invoiceNumber])

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

  const expense = data?.expense || {}
  const currency = data?.tenant?.currency || 'Rs.'
  const balance = data?.balance || 0
  const credit = Number(expense.credit || 0)

  return (
    <div className="inv-backdrop" onClick={onClose}>
      <div className="inv-modal" onClick={e => e.stopPropagation()}>

        {loading && <div className="inv-loading">Loading invoice...</div>}

        {error && <div className="inv-loading" style={{ color: 'var(--danger)' }}>{error}</div>}

        {data && !loading && (
          <>
            <div className="inv-header">
              <div className="inv-header-left">
                <button className="inv-close-btn" onClick={onClose} aria-label="Close invoice"><CloseX /></button>
                <div>
                  <div className="inv-header-title">Expense Invoice</div>
                  <div className="inv-header-num">{invoiceNumber}</div>
                </div>
              </div>
              <button className="inv-print-btn" onClick={handlePrint}><PrinterIcon /> Print / PDF</button>
            </div>

            <div className="inv-body">
              <div className="inv-identity">
                <div className="inv-shop-name">{data?.tenant?.name || 'Tailor Shop'}</div>
                <div className="inv-invoice-id">{invoiceNumber}</div>
              </div>
              <hr className="inv-divider" />

              <div className="inv-section">
                <div className="inv-section-title">Expense Details</div>
                <div className="inv-row"><span className="inv-row-label">Description</span><span className="inv-row-value">{expense.description || '—'}</span></div>
                <div className="inv-row"><span className="inv-row-label">Payee Name</span><span className="inv-row-value">{expense.payee_name || '—'}</span></div>
                <div className="inv-row"><span className="inv-row-label">Date Created</span><span className="inv-row-value">{formatDate(expense.created_at)}</span></div>
              </div>
              <hr className="inv-divider" />

              <div className="inv-section">
                <div className="inv-section-title">Payment Summary</div>
                <div className="inv-row">
                  <span className="inv-row-label">Total Amount</span>
                  <span className="inv-row-value inv-amount-value">{currency} {Number(expense.amount || 0).toFixed(0)}</span>
                </div>
                <div className="inv-row">
                  <span className="inv-row-label">Amount Paid</span>
                  <span className="inv-row-value">{currency} {Number(expense.amount_paid || 0).toFixed(0)}</span>
                </div>
                {credit > 0 && (
                  <div className="inv-row">
                    <span className="inv-row-label">Credit</span>
                    <span className="inv-row-value inv-credit-label">{currency} {credit.toFixed(0)}</span>
                  </div>
                )}
                <div className="inv-row">
                  <span className="inv-row-label">Balance Remaining</span>
                  <span className="inv-row-value inv-balance-remaining">{currency} {Number(balance).toFixed(0)}</span>
                </div>

                {data?.payments?.length > 0 && (
                  <div className="inv-payments-list">
                    <div className="inv-section-title" style={{ marginTop: 12, marginBottom: 6 }}>Payments Made</div>
                    {data.payments.map((p, i) => (
                      <div className="inv-payment-row" key={i}>
                        <span>{formatDate(p.payment_date)}</span>
                        <span>{p.payment_mode || '—'}</span>
                        <span>{currency} {Number(p.amount).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {data?.tenant?.receipt_footer && <div className="inv-footer">{data.tenant.receipt_footer}</div>}
              <div className="inv-footer">Generated on {todayStr()} · TailorOps</div>
            </div>

            <div className="inv-close-bottom">
              <button className="inv-close-bottom-btn" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
