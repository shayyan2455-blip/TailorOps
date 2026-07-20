import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

const AuthContext = createContext(null)

const ADMIN_EMAIL = 'liberaltech.official@gmail.com'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tenantStatus, setTenantStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
  }, [])

  const fetchTenantStatus = useCallback(async (tenantId) => {
    if (!tenantId) { setTenantStatus(null); return }
    const { data, error } = await supabase.rpc('get_my_tenant_status')
    if (!error && data && data.length > 0) {
      setTenantStatus(data[0])
    }
  }, [])

  const refreshAuthState = useCallback(async (userId, userEmail) => {
    if (!userId) {
      setProfile(null)
      setTenantStatus(null)
      setLoading(false)
      return
    }
    await fetchProfile(userId)
    setLoading(false)
  }, [fetchProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchTenantStatus(profile.tenant_id)
    }
  }, [profile, fetchTenantStatus])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }, [])

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

    setUser(data.user)
    setSession(data.session)
    if (data.user) fetchProfile(data.user.id)
    setTenantStatus({ status: 'pending', rejection_reason: null, tenant_name: shopName })

    return data
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const isAdmin = user?.email === ADMIN_EMAIL
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
