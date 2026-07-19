import { useRef } from 'react'

export default function ReceiptView({ payment, order, balance, onClose }) {
  const ref = useRef(null)

  const handlePrint = () => {
    const printWin = window.open('', '_blank')
    if (!printWin) return
    printWin.document.write(`
      <html><head><title>Receipt - ${order?.order_number}</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 13px; max-width: 320px; margin: 0 auto; padding: 20px; color: #000; }
        h2 { text-align: center; font-size: 18px; margin-bottom: 4px; }
        .line { border-top: 1px dashed #999; margin: 12px 0; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .label { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 4px 0; }
        th { border-bottom: 1px solid #999; }
        .right { text-align: right; }
        .center { text-align: center; }
        .total { font-size: 16px; font-weight: 700; margin-top: 8px; }
        @media print { body { margin: 0; padding: 16px; } }
      </style></head><body>
        <h2>TailorOps</h2>
        <p class="center" style="margin:0 0 4px">Payment Receipt</p>
        <div class="line"></div>
        <div class="row"><span class="label">Order</span><span>${order?.order_number || ''}</span></div>
        <div class="row"><span class="label">Customer</span><span>${order?.customers?.name || ''}</span></div>
        <div class="row"><span class="label">Date</span><span>${payment?.payment_date || ''}</span></div>
        <div class="line"></div>
        <div class="row"><span class="label">Payment mode</span><span>${payment?.payment_mode || ''}</span></div>
        <div class="row" style="font-size:16px;font-weight:700;margin-top:8px"><span>Amount Paid</span><span>Rs. ${Number(payment?.amount || 0).toFixed(0)}</span></div>
        <div class="line"></div>
        <div class="row"><span>Total order</span><span>Rs. ${Number(balance?.total_amount || 0).toFixed(0)}</span></div>
        <div class="row"><span>Total paid</span><span>Rs. ${Number(balance?.total_paid || 0).toFixed(0)}</span></div>
        <div class="row" style="font-weight:600"><span>Balance</span><span>Rs. ${Number(balance?.balance || 0).toFixed(0)}</span></div>
        <div class="line"></div>
        <p class="center" style="font-size:11px;color:#666">Thank you for your business!</p>
      </body></html>
    `)
    printWin.document.close()
    printWin.focus()
    setTimeout(() => printWin.print(), 300)
  }

  return (
    <div className="c-backdrop" onClick={onClose}>
      <div className="c-form-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div ref={ref} style={{ fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 1.6 }}>
          <h3 style={{ textAlign: 'center', margin: '0 0 4px', fontFamily: "'Fraunces', serif" }}>TailorOps</h3>
          <p style={{ textAlign: 'center', margin: '0 0 12px', opacity: 0.6, fontSize: 11 }}>Payment Receipt</p>
          <div style={{ borderTop: '1px dashed', opacity: 0.2, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>Order</span><span>{order?.order_number}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>Customer</span><span>{order?.customers?.name}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>Date</span><span>{payment?.payment_date}</span></div>
          <div style={{ borderTop: '1px dashed', opacity: 0.2, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>Mode</span><span>{payment?.payment_mode}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, marginTop: 8 }}>
            <span>Amount Paid</span><span>Rs. {Number(payment?.amount || 0).toFixed(0)}</span>
          </div>
          <div style={{ borderTop: '1px dashed', opacity: 0.2, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total order</span><span>Rs. {Number(balance?.total_amount || 0).toFixed(0)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Total paid</span><span>Rs. {Number(balance?.total_paid || 0).toFixed(0)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span>Balance</span><span>Rs. {Number(balance?.balance || 0).toFixed(0)}</span></div>
        </div>
        <div className="c-form-actions" style={{ marginTop: 16 }}>
          <button className="c-form-cancel" onClick={onClose}>Close</button>
          <button className="c-form-save" onClick={handlePrint}>Print / Save PDF</button>
        </div>
      </div>
    </div>
  )
}
