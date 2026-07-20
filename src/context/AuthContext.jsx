import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tenantStatus, setTenantStatus] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
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

  const checkAdmin = useCallback(async () => {
    const { data, error } = await supabase.rpc('check_is_admin')
    if (!error) setIsAdmin(!!data)
    else setIsAdmin(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        checkAdmin()
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        checkAdmin()
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile, checkAdmin])

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
