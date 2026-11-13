// The only door into The Compound.
//
// Deployed with `--no-verify-jwt`, because signed-out visitors call it.
// It runs with the service role, which is why "Allow new users to sign up" can stay OFF in
// Supabase Auth forever: this function is the only thing that ever creates a user.
//
// It never returns anything that would let a caller probe the allow-list: an unknown email and
// an approved one get the same reply. A wrong *code* is reported as wrong, because the code is
// the secret and the rate limit is what protects it.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Deliberately identical for "never heard of you" and "you're approved, link sent".
const NEUTRAL = { ok: true, message: 'checkEmail' as const }

function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('cf-connecting-ip')
}

function validEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'methodNotAllowed' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'badRequest' }, 400)
  }

  const action = body.action === 'notify' ? 'notify' : 'access'
  const rawEmail = body.email
  if (!validEmail(rawEmail)) return json({ ok: false, error: 'badEmail' }, 400)
  const email = rawEmail.trim().toLowerCase()
  const ip = clientIp(req)
  const code = typeof body.code === 'string' ? body.code : null
  const token = typeof body.token === 'string' ? body.token : null

  // The rate limit is computed from this table, so a failed write is a security problem,
  // not a cosmetic one. It must never be ignored. (It was, once — the gate looked healthy
  // while logging nothing and rate-limiting nobody.)
  const log = async (outcome: string) => {
    const { error } = await admin.from('access_attempts').insert({ email, ip, outcome })
    if (error) {
      console.error('access_attempts insert failed', error.message)
      return false
    }
    return true
  }

  // ---- notify-me: store and reveal nothing ----
  if (action === 'notify') {
    const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null
    // A repeat signup is not an error and must not be reported as one, or the waitlist
    // becomes an email-existence oracle. Any other failure is real and must surface.
    const { error } = await admin
      .from('waitlist').upsert({ email, note }, { onConflict: 'email', ignoreDuplicates: true })
    if (error) {
      console.error('waitlist upsert failed', error.message)
      return json({ ok: false, error: 'serverError' }, 500)
    }
    await log('waitlisted')
    return json({ ok: true, message: 'waitlisted' })
  }

  // ---- rate limit before doing any work ----
  const { data: limited, error: limitErr } = await admin.rpc('access_rate_limited', {
    p_email: email,
    p_ip: ip,
  })
  if (limitErr) return json({ ok: false, error: 'serverError' }, 500)
  if (limited) {
    await log('denied_rate_limited')
    return json({ ok: false, error: 'tooManyAttempts' }, 429)
  }

  // ---- already a member? then this is an ordinary sign-in ----
  const { data: existingMember } = await admin
    .from('members').select('id').eq('email', email).maybeSingle()

  let familyId: string | null = null
  let outcome = 'denied_unknown'

  if (existingMember) {
    outcome = 'granted_allowlist'
  } else if (token) {
    const { data } = await admin.rpc('verify_invite_token', { p_token: token, p_email: email })
    if (data) { familyId = data as string; outcome = 'granted_invite' }
    else { await log('denied_bad_code'); return json({ ok: false, error: 'badInvite' }, 403) }
  } else {
    const { data: allowed } = await admin
      .from('allowed_emails').select('family_id').eq('email', email).maybeSingle()
    if (allowed) {
      familyId = allowed.family_id as string
      outcome = 'granted_allowlist'
    } else if (code) {
      const { data } = await admin.rpc('verify_access_code', { p_code: code })
      if (data) { familyId = data as string; outcome = 'granted_code' }
      else {
        await log('denied_bad_code')
        return json({ ok: false, error: 'badCode' }, 403)
      }
    }
  }

  if (!existingMember && !familyId) {
    // Unknown email, no code. Same answer as a successful allow-list match, so that this
    // endpoint cannot be used to discover who has been approved.
    await log('denied_unknown')
    return json(NEUTRAL)
  }

  // ---- grant: record the invite, make sure the auth user exists ----
  if (familyId) {
    // consumed_at is reset explicitly: without it, re-granting access to someone whose
    // earlier invite was already claimed would leave them unable to join.
    const { error } = await admin.from('invites').upsert(
      { email, family_id: familyId, consumed_at: null },
      { onConflict: 'email', ignoreDuplicates: false },
    )
    if (error) return json({ ok: false, error: 'serverError' }, 500)
  }

  // createUser is idempotent enough for our purposes: an "already registered" error is fine,
  // because the client's signInWithOtp works for existing users even with sign-ups disabled.
  const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (createErr && !/already|registered|exists/i.test(createErr.message)) {
    return json({ ok: false, error: 'serverError' }, 500)
  }

  if (!(await log(outcome))) {
    // Refuse rather than grant access we cannot account for.
    return json({ ok: false, error: 'serverError' }, 500)
  }
  return json(NEUTRAL)
})
