import { useRef } from 'react'

export default function ReceiptView({ payment, customer, orders, onClose }) {
  const ref = useRef(null)

  const handlePrint = () => {
    const printWin = window.open('', '_blank')
    if (!printWin) return
    const orderRows = (orders || []).map(o => `
      <tr><td>${o.order_number}</td><td class="right">Rs. ${Number(o.total_amount).toFixed(0)}</td><td class="right">Rs. ${Number(o.paid).toFixed(0)}</td><td class="right">Rs. ${Math.max(0, o.balance).toFixed(0)}</td></tr>
    `).join('')
    const totalPaid = (orders || []).reduce((s, o) => s + Number(o.paid), 0)
    const totalBalance = (orders || []).reduce((s, o) => s + Math.max(0, o.balance), 0)
    printWin.document.write(`
      <html><head><title>Receipt - ${customer?.name || ''}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 13px; max-width: 380px; margin: 0 auto; padding: 20px; color: #000; }
        h2 { text-align: center; font-size: 18px; margin-bottom: 4px; }
        .line { border-top: 1px dashed #999; margin: 12px 0; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .label { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { text-align: left; padding: 4px 0; font-size: 12px; }
        th { border-bottom: 1px solid #999; font-weight: 600; }
        .right { text-align: right; }
        .center { text-align: center; }
        .total { font-size: 16px; font-weight: 700; margin-top: 8px; }
        @media print { body { margin: 0; padding: 16px; } }
      </style></head><body>
        <h2>TailorOps</h2>
        <p class="center" style="margin:0 0 4px">Payment Receipt</p>
        <div class="line"></div>
        <div class="row"><span class="label">Customer</span><span>${customer?.name || ''}</span></div>
        <div class="row"><span class="label">Date</span><span>${payment?.payment_date || ''}</span></div>
        <div class="row"><span class="label">Mode</span><span>${payment?.payment_mode || ''}</span></div>
        <div class="line"></div>
        <div class="row" style="font-size:16px;font-weight:700"><span>Amount Paid</span><span>Rs. ${Number(payment?.amount || 0).toFixed(0)}</span></div>
        <div class="line"></div>
        <p style="margin:0 0 4px;font-weight:600">Order Breakdown</p>
        <table>
          <tr><th>Order</th><th class="right">Total</th><th class="right">Paid</th><th class="right">Balance</th></tr>
          ${orderRows}
        </table>
        <div class="line"></div>
        <div class="row"><span>Total paid across orders</span><span>Rs. ${Number(totalPaid).toFixed(0)}</span></div>
        <div class="row" style="font-weight:600"><span>Remaining balance</span><span>Rs. ${Number(totalBalance).toFixed(0)}</span></div>
        <div class="line"></div>
        ${payment?.notes ? `<p style="font-size:11px;color:#666">Note: ${payment.notes}</p>` : ''}
        <p class="center" style="font-size:11px;color:#666">Thank you for your business!</p>
      </body></html>
    `)
    printWin.document.close()
    printWin.focus()
    setTimeout(() => printWin.print(), 300)
  }

  const totalPaid = (orders || []).reduce((s, o) => s + Number(o.paid || 0), 0)
  const totalBalance = (orders || []).reduce((s, o) => s + Math.max(0, Number(o.balance || 0)), 0)

  return (
    <div className="c-backdrop" onClick={onClose}>
      <div className="c-form-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div ref={ref} style={{ fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 1.6 }}>
          <h3 style={{ textAlign: 'center', margin: '0 0 4px', fontFamily: "'Fraunces', serif" }}>TailorOps</h3>
          <p style={{ textAlign: 'center', margin: '0 0 12px', opacity: 0.6, fontSize: 11 }}>Payment Receipt</p>
          <div style={{ borderTop: '1px dashed', opacity: 0.2, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>Customer</span><span>{customer?.name}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>Date</span><span>{payment?.payment_date}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>Mode</span><span>{payment?.payment_mode}</span></div>
          <div style={{ borderTop: '1px dashed', opacity: 0.2, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
            <span>Amount Paid</span><span>Rs. {Number(payment?.amount || 0).toFixed(0)}</span>
          </div>
          <div style={{ borderTop: '1px dashed', opacity: 0.2, margin: '8px 0' }} />
          <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: 12 }}>Order Breakdown</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.5, borderBottom: '1px solid', paddingBottom: 4, marginBottom: 4 }}>
            <span>Order</span><span>Total → Paid → Bal</span>
          </div>
          {orders?.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
              <span className="mono" style={{ fontSize: 11 }}>{o.order_number}</span>
              <span>Rs.{Number(o.total_amount).toFixed(0)} → Rs.{Number(o.paid).toFixed(0)} → Rs.{Math.max(0, o.balance).toFixed(0)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed', opacity: 0.2, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total paid</span><span>Rs. {Number(totalPaid).toFixed(0)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>Remaining balance</span><span>Rs. {Number(totalBalance).toFixed(0)}</span></div>
          {payment?.notes && <p style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>Note: {payment.notes}</p>}
        </div>
        <div className="c-form-actions" style={{ marginTop: 16 }}>
          <button className="c-form-cancel" onClick={onClose}>Close</button>
          <button className="c-form-save" onClick={handlePrint}>Print / Save PDF</button>
        </div>
      </div>
    </div>
  )
}
