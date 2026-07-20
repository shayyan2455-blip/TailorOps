import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tenantStatus, setTenantStatus] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const ready = useRef(false)

  const resolveState = useCallback(async (session) => {
    const u = session?.user ?? null
    setUser(u)
    setSession(session)

    if (!u) {
      setProfile(null)
      setTenantStatus(null)
      setIsAdmin(false)
      setLoading(false)
      ready.current = true
      return
    }

    const [profResult, adminResult] = await Promise.allSettled([
      supabase.from('profiles').select('*').eq('id', u.id).single(),
      supabase.rpc('check_is_admin'),
    ])

    if (profResult.status === 'fulfilled') {
      setProfile(profResult.value.data)
    } else {
      setProfile(null)
    }

    if (adminResult.status === 'fulfilled') {
      setIsAdmin(!!adminResult.value.data)
    } else {
      setIsAdmin(false)
    }

    const tenantId = profResult.status === 'fulfilled' ? profResult.value.data?.tenant_id : null
    if (tenantId) {
      const { data } = await supabase.rpc('get_my_tenant_status')
      if (data && data.length > 0) {
        setTenantStatus(data[0])
      }
    }

    setLoading(false)
    ready.current = true
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveState(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      ready.current = false
      setLoading(true)
      resolveState(session)
    })

    return () => subscription.unsubscribe()
  }, [resolveState])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    ready.current = false
    setLoading(true)
    await resolveState(data.session)
    return data
  }, [resolveState])

  const signUp = useCallback(async (email, password, shopName, ownerName) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error

    const userId = data.user?.id
    if (!userId) throw new Error('Sign-up succeeded but user ID was not returned.')

    const { error: rpcError } = await supabase.rpc('create_tenant_and_profile', {
      tenant_name: shopName,
      owner_name: ownerName,
      user_id: userId,
    })
    if (rpcError) throw rpcError

    ready.current = false
    setLoading(true)
    await resolveState(data.session)

    return data
  }, [resolveState])

  const signOut = useCallback(async () => {
    setIsAdmin(false)
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const tenantId = profile?.tenant_id || null

  const value = {
    user, session, profile, tenantId, tenantStatus,
    loading, isAdmin,
    signIn, signUp, signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthContext')
  return ctx
}
