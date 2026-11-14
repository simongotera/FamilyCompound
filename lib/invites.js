// Handing out access, from inside the app.
//
// Every call here is an RPC into a SECURITY DEFINER function. The browser never names a family,
// never sees a hash, and never decides whether something is still valid — the database does all
// three. See supabase/migrations/20261113160000_invites_from_the_app.sql.

import { supabase } from '@/lib/supabaseClient'

// The database refuses with PostgREST-style SQLSTATEs so the reason survives the round trip
// without shipping an English sentence to a Spanish speaker.
const CODES = {
  PT400: 'invite.errBadInput',
  PT403: 'invite.errNotMember',
  PT404: 'invite.errGone',
  PT409: 'invite.errTooMany',
  PT429: 'invite.errSlowDown',
}

export function errorKey(error) {
  if (!error) return null
  return CODES[error.code] || 'invite.errGeneric'
}

function one(data) {
  return Array.isArray(data) ? data[0] : data
}

export async function listInvites() {
  const { data, error } = await supabase.rpc('my_family_invites')
  return { rows: data || [], errorKey: errorKey(error) }
}

// `days` is clamped in the database too; the form just keeps the obvious choices in front of you.
export async function createInviteLink({ label, days }) {
  const { data, error } = await supabase.rpc('create_invite_link', { p_label: label, p_days: days })
  return { invite: one(data), errorKey: errorKey(error) }
}

export async function createAccessCode({ label, days, maxUses }) {
  const { data, error } = await supabase.rpc('create_access_code', {
    p_label: label,
    p_days: days,
    p_max_uses: maxUses,
  })
  return { code: one(data), errorKey: errorKey(error) }
}

export async function revokeInvite({ kind, id }) {
  const { error } = await supabase.rpc('revoke_family_invite', { p_kind: kind, p_id: id })
  return { errorKey: errorKey(error) }
}

// The gate reads ?token= off whatever URL it is rendered at, so the invitation link is simply
// the site's own front door with the token on it.
export function inviteUrl(token, origin) {
  const base = origin || (typeof window === 'undefined' ? '' : window.location.origin)
  return `${base}/?token=${token}`
}

export function daysLeft(expiresAt) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt) - Date.now()) / 86400000)
}
