import { useEffect } from 'react'

export function useTableLabels(selector = 'table', deps = []) {
  useEffect(() => {
    document.querySelectorAll(selector).forEach(table => {
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
    })
  }, deps)
}
