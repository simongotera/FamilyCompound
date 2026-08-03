'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'
import en from './locales/en.json'
import es from './locales/es.json'

const dictionaries = { en, es }
const STORAGE_KEY = 'compound-locale'

const LocaleContext = createContext(null)

function getNested(obj, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), obj)
}

function interpolate(str, vars) {
  if (!vars) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : `{{${key}}}`))
}

export function LocaleProvider({ children }) {
  const { member } = useAuth()
  const [locale, setLocaleState] = useState('en')

  // Pick up a pre-login preference (e.g. toggled on the sign-in screen) as soon as we're in the browser.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && dictionaries[stored]) setLocaleState(stored)
  }, [])

  // Once a member profile loads, the account's saved locale wins; a brand-new profile adopts whatever was active.
  useEffect(() => {
    if (!member) return
    if (member.locale && dictionaries[member.locale] && member.locale !== locale) {
      setLocaleState(member.locale)
      window.localStorage.setItem(STORAGE_KEY, member.locale)
    } else if (!member.locale) {
      supabase.from('members').update({ locale }).eq('id', member.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id])

  function setLocale(next) {
    if (!dictionaries[next]) return
    setLocaleState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    if (member) supabase.from('members').update({ locale: next }).eq('id', member.id)
  }

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  function t(key, vars) {
    const value = getNested(dictionaries[locale], key) ?? getNested(dictionaries.en, key) ?? key
    return interpolate(value, vars)
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
