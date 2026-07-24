import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { fetchOrderForInvoice } from '../api/orderQueries'
import { fetchTenant } from '../../settings/api/settingsQueries'
import { useToast } from '../../../context/ToastContext'
import { formatDate } from '../../../shared/lib/formatDate'
import './InvoiceView.css'

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

function prettifyKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function InvoiceView({ orderId, onClose }) {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!orderId || !tenantId) return
    setLoading(true)
    setError(null)
    Promise.all([
      fetchOrderForInvoice(orderId),
      fetchTenant(tenantId),
    ])
      .then(([invoice, tenant]) => setData({ ...invoice, tenant }))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [orderId, tenantId])

  const invoiceNumber = data?.order?.id
    ? 'INV-' + data.order.id.replace(/-/g, '').slice(-8).toUpperCase()
    : 'INV-????????'

  const buildPrintHtml = useCallback(() => {
    if (!data) return ''
    const { order, payments, paid, balance, tenant } = data
    const c = order.customers || {}
    const currency = tenant?.currency || 'Rs.'
    const measurements = order.measurements?.[0]?.data || null

    const itemsRows = (order.order_items || []).map(i => `
      <tr>
        <td>${i.garment_name || '—'}</td>
        <td style="text-align:center">${i.quantity} x ${currency} ${Number(i.rate).toFixed(0)}</td>
        <td style="text-align:right">${currency} ${Number(i.amount).toFixed(0)}</td>
      </tr>`).join('')

    const measHtml = measurements
      ? Object.entries(measurements).map(([k, v]) =>
          `<div class="m-item"><span class="m-label">${prettifyKey(k)}</span><span class="m-value">${v || '—'}</span></div>`
        ).join('')
      : ''

    const paymentsRows = (payments || []).map(p => `
      <div class="pmt-row">
        <span>${formatDate(p.payment_date)}</span>
        <span>${p.payment_mode || '—'}</span>
        <span>${currency} ${Number(p.amount).toFixed(0)}</span>
      </div>`).join('')

    return `<!DOCTYPE html>
<html>
<head>
  <title>Invoice ${invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 13px;
      color: #111;
      background: #fff;
      line-height: 1.5;
      max-width: 680px;
      margin: 0 auto;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-top: 4px; }
    .header-left { font-size: 16px; font-weight: 700; color: #111; }
    .header-right { font-size: 11px; color: #555; font-family: 'Courier New', monospace; }
    .identity { text-align: center; padding: 8px 0 12px; }
    .shop-name { font-size: 24px; font-weight: 700; color: #111; letter-spacing: 0.01em; margin-bottom: 2px; }
    .inv-id { font-size: 10px; color: #666; font-family: 'Courier New', monospace; margin-top: 4px; }
    hr { border: none; border-top: 1px solid #ccc; margin: 0; }
    .section { padding: 12px 0; }
    .section-title { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; margin-bottom: 6px; font-family: 'Courier New', monospace; }
    .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
    .row-label { color: #444; }
    .row-value { text-align: right; color: #111; }
    .amount-value { font-size: 18px; font-weight: 700; color: #000; }
    .balance { color: #c0392b; font-weight: 600; }
    .footer { text-align: center; font-size: 10px; color: #666; padding-top: 8px; border-top: 1px solid #ccc; margin-top: 8px; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.items th { text-align: left; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; font-family: 'Courier New', monospace; padding: 6px 4px 6px 0; border-bottom: 1px solid #ccc; }
    table.items td { padding: 5px 4px 5px 0; border-bottom: 1px solid #eee; font-size: 13px; }
    table.items th:last-child, table.items td:last-child { text-align: right; padding-right: 0; }
    table.items th:nth-child(2) { text-align: center; }
    table.items td:nth-child(2) { text-align: center; }
    .measurements { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 2px 16px; margin-top: 4px; }
    .m-item { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; border-bottom: 1px solid #f0f0f0; }
    .m-label { color: #666; }
    .m-value { font-weight: 500; }
    .notes { font-size: 12px; color: #333; margin-top: 4px; padding: 6px 10px; background: #f9f9f9; border-radius: 4px; }
    .payments { margin-top: 6px; }
    .pmt-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0 2px 10px; color: #555; border-left: 2px solid #eee; }
    .pmt-row span:first-child { flex: 1; }
    .pmt-row span:nth-child(2) { margin: 0 12px; }
    .pmt-row span:last-child { text-align: right; font-weight: 500; color: #111; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">Invoice</div>
    <div class="header-right">${invoiceNumber}</div>
  </div>

  <div class="identity">
    <div class="shop-name">${tenant?.name || 'Tailor Shop'}</div>
    <div class="inv-id">${invoiceNumber}</div>
  </div>
  <hr />

  <div class="section">
    <div class="section-title">Order Details</div>
    <div class="row"><span class="row-label">Order #</span><span class="row-value">${order.order_number || '—'}</span></div>
    <div class="row"><span class="row-label">Date Booked</span><span class="row-value">${formatDate(order.created_at)}</span></div>
    <div class="row"><span class="row-label">Current Stage</span><span class="row-value">${order.current_stage || '—'}</span></div>
    <div class="row"><span class="row-label">Delivery Date</span><span class="row-value">${order.delivery_date ? formatDate(order.delivery_date) : '—'}</span></div>
  </div>
  <hr />

  <div class="section">
    <div class="section-title">Customer Details</div>
    <div class="row"><span class="row-label">Name</span><span class="row-value">${c?.name || '—'}</span></div>
    <div class="row"><span class="row-label">Phone</span><span class="row-value">${c?.mobile || '—'}</span></div>
    <div class="row"><span class="row-label">Address</span><span class="row-value">${c?.address || '—'}</span></div>
  </div>
  <hr />

  ${measurements ? `
  <div class="section">
    <div class="section-title">Measurements</div>
    <div class="measurements">${measHtml}</div>
  </div>
  <hr />` : ''}

  <div class="section">
    <div class="section-title">Order Items</div>
    <table class="items">
      <thead>
        <tr>
          <th>Garment</th>
          <th style="text-align:center">Qty × Rate</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows || '<tr><td colspan="3" style="color:#888">No items</td></tr>'}
      </tbody>
    </table>
  </div>
  <hr />

  ${order.notes ? `
  <div class="section">
    <div class="section-title">Notes</div>
    <div class="notes">${order.notes}</div>
  </div>
  <hr />` : ''}

  <div class="section">
    <div class="section-title">Payment Summary</div>
    <div class="row"><span class="row-label">Total Amount</span><span class="row-value amount-value">${currency} ${Number(order.total_amount).toFixed(0)}</span></div>
    <div class="row"><span class="row-label">Amount Paid</span><span class="row-value">${currency} ${Number(paid).toFixed(0)}</span></div>
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

  const order = data?.order || {}
  const c = order.customers || {}
  const currency = data?.tenant?.currency || 'Rs.'
  const paid = data?.paid || 0
  const balance = data?.balance || 0
  const measurements = order.measurements?.[0]?.data || null

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
                  <div className="inv-header-title">Invoice</div>
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
                <div className="inv-section-title">Order Details</div>
                <div className="inv-row"><span className="inv-row-label">Order #</span><span className="inv-row-value">{order.order_number || '—'}</span></div>
                <div className="inv-row"><span className="inv-row-label">Date Booked</span><span className="inv-row-value">{formatDate(order.created_at)}</span></div>
                <div className="inv-row"><span className="inv-row-label">Current Stage</span><span className="inv-row-value">{order.current_stage || '—'}</span></div>
                <div className="inv-row"><span className="inv-row-label">Delivery Date</span><span className="inv-row-value">{order.delivery_date ? formatDate(order.delivery_date) : '—'}</span></div>
              </div>
              <hr className="inv-divider" />

              <div className="inv-section">
                <div className="inv-section-title">Customer Details</div>
                <div className="inv-row"><span className="inv-row-label">Name</span><span className="inv-row-value">{c?.name || '—'}</span></div>
                <div className="inv-row"><span className="inv-row-label">Phone</span><span className="inv-row-value">{c?.mobile || '—'}</span></div>
                <div className="inv-row"><span className="inv-row-label">Address</span><span className="inv-row-value">{c?.address || '—'}</span></div>
              </div>
              <hr className="inv-divider" />

              {measurements && (
                <>
                  <div className="inv-section">
                    <div className="inv-section-title">Measurements</div>
                    <div className="inv-measurements-grid">
                      {Object.entries(measurements).map(([k, v]) => (
                        <div className="inv-measurement-item" key={k}>
                          <span className="inv-measurement-label">{prettifyKey(k)}</span>
                          <span className="inv-measurement-value">{v || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <hr className="inv-divider" />
                </>
              )}

              <div className="inv-section">
                <div className="inv-section-title">Order Items</div>
                <table className="inv-items-table">
                  <thead>
                    <tr>
                      <th>Garment</th>
                      <th style={{ textAlign: 'center' }}>Qty × Rate</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.order_items || []).length === 0 ? (
                      <tr><td colSpan={3} style={{ color: 'var(--text-dim)' }}>No items</td></tr>
                    ) : (
                      (order.order_items || []).map((item, i) => (
                        <tr key={i}>
                          <td>{item.garment_name || '—'}</td>
                          <td style={{ textAlign: 'center' }}>{item.quantity} x {currency}{Number(item.rate).toFixed(0)}</td>
                          <td style={{ textAlign: 'right' }}>{currency}{Number(item.amount).toFixed(0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <hr className="inv-divider" />

              {order.notes && (
                <>
                  <div className="inv-section">
                    <div className="inv-section-title">Notes</div>
                    <div className="inv-notes">{order.notes}</div>
                  </div>
                  <hr className="inv-divider" />
                </>
              )}

              <div className="inv-section">
                <div className="inv-section-title">Payment Summary</div>
                <div className="inv-row">
                  <span className="inv-row-label">Total Amount</span>
                  <span className="inv-row-value inv-amount-value">{currency} {Number(order.total_amount || 0).toFixed(0)}</span>
                </div>
                <div className="inv-row">
                  <span className="inv-row-label">Amount Paid</span>
                  <span className="inv-row-value">{currency} {Number(paid).toFixed(0)}</span>
                </div>
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
