import { useEffect, useRef } from 'react'

function labelTable(table) {
  const ths = table.querySelectorAll('thead th')
  if (!ths.length) return
  table.querySelectorAll('tbody tr').forEach(tr => {
    tr.querySelectorAll('td').forEach((td, i) => {
      const label = ths[i]?.textContent?.trim()
      if (label && !td.hasAttribute('data-label')) {
        td.setAttribute('data-label', label)
      }
    })
  })
}

export function useTableLabels(selector = 'table', deps = []) {
  const observerRef = useRef(null)

  useEffect(() => {
    document.querySelectorAll(selector).forEach(labelTable)

    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new MutationObserver(() => {
      document.querySelectorAll(selector).forEach(labelTable)
    })
    observerRef.current.observe(document.body, { childList: true, subtree: true })

    return () => observerRef.current?.disconnect()
  }, deps)
}
