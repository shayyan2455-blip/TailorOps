import { useEffect, useRef } from 'react'

function isMobile() {
  return window.innerWidth <= 600
}

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

function styleActionCells() {
  if (!isMobile()) return

  document.querySelectorAll('td.c-actions').forEach(td => {
    td.style.display = 'flex'
    td.style.flexDirection = 'column'
    td.style.alignItems = 'flex-end'
    td.style.gap = '6px'
    td.style.borderTop = '1px solid var(--border-color)'
    td.style.marginTop = '4px'
    td.style.paddingTop = '8px'
  })

  document.querySelectorAll('td > div[style*="flex"]').forEach(div => {
    div.style.flexDirection = 'column'
    div.style.alignItems = 'flex-end'
    div.style.gap = '6px'
    div.style.width = '100%'
  })
}

function unstyleActionCells() {
  document.querySelectorAll('td.c-actions').forEach(td => {
    td.style.display = ''
    td.style.flexDirection = ''
    td.style.alignItems = ''
    td.style.gap = ''
    td.style.borderTop = ''
    td.style.marginTop = ''
    td.style.paddingTop = ''
  })

  document.querySelectorAll('td > div[style*="flex"]').forEach(div => {
    div.style.flexDirection = ''
    div.style.alignItems = ''
    div.style.gap = ''
    div.style.width = ''
  })
}

function run(selector) {
  document.querySelectorAll(selector).forEach(labelTable)
  styleActionCells()
}

export function useTableLabels(selector = 'table', deps = []) {
  const observerRef = useRef(null)

  useEffect(() => {
    run(selector)

    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new MutationObserver(() => {
      run(selector)
    })
    observerRef.current.observe(document.body, { childList: true, subtree: true })

    const onResize = () => {
      if (isMobile()) {
        styleActionCells()
      } else {
        unstyleActionCells()
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      observerRef.current?.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, deps)
}
