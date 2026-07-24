import { formatDate } from './formatDate'

export function printLedgerStatement({ tenant, partyLabel, partyName, partyMeta, entries, closingBalance }) {
  const currency = tenant?.currency || 'Rs.'
  const rows = entries.map(e => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td>${e.description}${e.ref ? ` — ${e.ref}` : ''}</td>
      <td class="num">${e.debit > 0 ? currency + ' ' + Number(e.debit).toFixed(0) : '—'}</td>
      <td class="num">${e.credit > 0 ? currency + ' ' + Number(e.credit).toFixed(0) : '—'}</td>
      <td class="num">${currency} ${Number(e.running_balance).toFixed(0)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html><head><title>${partyLabel} Statement — ${partyName}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12.5px; color: #111; }
  .identity { text-align: center; margin-bottom: 16px; }
  .shop-name { font-size: 20px; font-weight: 700; }
  .meta { font-size: 11px; color: #555; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 14px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
  th { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; font-family: 'Courier New', monospace; }
  .num { text-align: right; font-family: 'Courier New', monospace; }
  .closing { font-weight: 700; font-size: 14px; text-align: right; margin-top: 14px; }
  .footer { text-align: center; font-size: 10px; color: #666; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; }
</style></head>
<body>
  <div class="identity">
    <div class="shop-name">${tenant?.name || 'Tailor Shop'}</div>
    <div class="meta">${partyLabel} Statement — ${partyName}${partyMeta ? ' · ' + partyMeta : ''}</div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="closing">Closing Balance: ${currency} ${Number(closingBalance).toFixed(0)}</div>
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
