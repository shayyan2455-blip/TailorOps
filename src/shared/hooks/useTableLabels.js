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

function run(selector) {
  document.querySelectorAll(selector).forEach(labelTable)
}

export function useTableLabels(selector = 'table', deps = []) {
  const observerRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    run(selector)

    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new MutationObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        run(selector)
        rafRef.current = null
      })
    })
    observerRef.current.observe(document.body, { childList: true, subtree: true })

    return () => {
      observerRef.current?.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, deps)
}