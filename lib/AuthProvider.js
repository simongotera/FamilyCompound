'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = signed out
  const [member, setMember] = useState(null)
  const [loadingMember, setLoadingMember] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadMember() {
      if (!session) {
        setMember(null)
        setLoadingMember(false)
        return
      }
      setLoadingMember(true)
      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .maybeSingle()
      setMember(data)
      setLoadingMember(false)
    }
    loadMember()
  }, [session])

  // Joining goes through a SECURITY DEFINER function that reads the invite for the email in
  // the caller's own JWT. The client never chooses a family, and members has no INSERT policy.
  async function createMemberProfile(name, household, locale) {
    const { data, error } = await supabase.rpc('join_my_family', {
      p_name: name,
      p_household: household || null,
      p_locale: locale,
    })
    const row = Array.isArray(data) ? data[0] : data
    if (!error && row) setMember(row)
    return { data: row, error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, member, loadingMember, createMemberProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
