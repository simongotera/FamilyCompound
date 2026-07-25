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

  async function createMemberProfile(name, household) {
    const { data, error } = await supabase
      .from('members')
      .insert({
        auth_user_id: session.user.id,
        name,
        household,
        email: session.user.email,
      })
      .select()
      .single()
    if (!error) setMember(data)
    return { data, error }
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
