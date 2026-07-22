import { createContext, useContext, useState, useCallback } from 'react'

const TopbarContext = createContext(null)

export function TopbarProvider({ children }) {
  const [title, setTitle] = useState('')
  const [action, setAction] = useState(null)

  const setTopbar = useCallback((t, a) => {
    setTitle(t)
    setAction(a)
  }, [])

  return (
    <TopbarContext.Provider value={{ title, action, setTopbar }}>
      {children}
    </TopbarContext.Provider>
  )
}

export function useTopbar() {
  const ctx = useContext(TopbarContext)
  if (!ctx) return { title: '', action: null, setTopbar: () => {} }
  return ctx
}
