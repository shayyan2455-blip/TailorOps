import { useState, useRef, useEffect } from 'react'

export default function SearchSelect({ options, value, onChange, placeholder, labelKey, className, renderItem, inputRef: externalRef }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focusedIdx, setFocusedIdx] = useState(0)
  const innerRef = useRef(null)
  const inputRef = externalRef || innerRef
  const wrapRef = useRef(null)

  const selected = options.find(o => o.id === value)
  const filtered = query.trim()
    ? options.filter(o =>
        String(o[labelKey || 'name']).toLowerCase().includes(query.toLowerCase())
      )
    : options

  useEffect(() => {
    if (!value && query) setQuery('')
  }, [value])

  useEffect(() => {
    if (selected && !query) {
      setQuery(selected[labelKey || 'name'])
    }
  }, [selected, query, labelKey])

  const handleInput = (e) => {
    setQuery(e.target.value)
    setOpen(true)
    setFocusedIdx(0)
    if (value) onChange('')
  }

  const handleSelect = (opt) => {
    onChange(opt.id)
    setQuery(opt[labelKey || 'name'])
    setOpen(false)
  }

  const handleKey = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true)
        e.preventDefault()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIdx(i => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIdx(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[focusedIdx]) handleSelect(filtered[focusedIdx])
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className={className || 'c-form-input'}
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => { setOpen(true); setFocusedIdx(0) }}
        onKeyDown={handleKey}
        placeholder={placeholder || 'Search...'}
        autoComplete="off"
      />
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'var(--second-bg-color)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          marginTop: 4,
          maxHeight: 220,
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 13, opacity: 0.4 }}>No results</div>
          ) : (
            filtered.map((opt, i) => (
              <div
                key={opt.id}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setFocusedIdx(i)}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  background: i === focusedIdx ? 'color-mix(in srgb, var(--main-color) 12%, transparent)' : 'transparent',
                  color: i === focusedIdx ? 'var(--main-color)' : 'var(--text-color)',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}
              >
                {renderItem ? renderItem(opt) : opt[labelKey || 'name']}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
