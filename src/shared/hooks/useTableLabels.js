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
    td.style.setProperty('display', 'flex', 'important')
    td.style.setProperty('flex-direction', 'column', 'important')
    td.style.setProperty('align-items', 'flex-end', 'important')
    td.style.setProperty('gap', '6px', 'important')
    td.style.setProperty('border-top', '1px solid var(--border-color)', 'important')
    td.style.setProperty('margin-top', '4px', 'important')
    td.style.setProperty('padding-top', '8px', 'important')
    td.setAttribute('data-mobile-action', 'true')
  })

  document.querySelectorAll('td > div[style*="flex"]').forEach(div => {
    div.style.setProperty('flex-direction', 'column', 'important')
    div.style.setProperty('align-items', 'flex-end', 'important')
    div.style.setProperty('gap', '6px', 'important')
    div.style.setProperty('width', '100%', 'important')
  })
}

function unstyleActionCells() {
  document.querySelectorAll('td.c-actions').forEach(td => {
    td.style.cssText = ''
  })
  document.querySelectorAll('td > div[style*="flex"]').forEach(div => {
    div.style.cssText = ''
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
