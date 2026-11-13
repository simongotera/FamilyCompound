// Reads and writes for the location quiz.
// Until supabase/migrations/20261113120000_location_quiz.sql is applied, the three quiz tables
// don't exist; then everything quiz-specific is kept in this browser's localStorage and the page
// says so. Country Profiles, parcels and members always come from Supabase.

import { supabase } from '@/lib/supabaseClient'

const LOCAL_KEY = 'compound-location-quiz-v1'

function isMissingTable(error) {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01' || /could not find the table|does not exist/i.test(error.message || '')
}

function readLocal() {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return { responses: [], facts: [], shortlists: [], ...(parsed || {}) }
  } catch {
    return { responses: [], facts: [], shortlists: [] }
  }
}

function writeLocal(data) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(data)) } catch { /* storage full or blocked */ }
}

function localId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const FACT_SELECT = '*, members(name)'

export async function loadQuizData() {
  const [countriesRes, parcelsRes, membersRes, prioritiesRes, responsesRes, factsRes, shortlistsRes] = await Promise.all([
    supabase.from('countries').select('*').order('name', { ascending: true }),
    supabase.from('land_options').select('*').order('created_at', { ascending: false }),
    supabase.from('members').select('id, name, household'),
    supabase.from('priorities').select('id, member_id, category, description, is_dealbreaker').eq('is_dealbreaker', true),
    supabase.from('location_quiz_responses').select('*'),
    supabase.from('location_facts').select(FACT_SELECT).order('created_at', { ascending: false }),
    supabase.from('location_shortlists').select('*, members(name)').order('created_at', { ascending: false }),
  ])

  const coreError = [countriesRes, parcelsRes, membersRes].find((r) => r.error)?.error
  if (coreError) return { error: coreError.message }

  const quizResults = [responsesRes, factsRes, shortlistsRes]
  const localMode = quizResults.some((r) => isMissingTable(r.error))
  const quizError = quizResults.find((r) => r.error && !isMissingTable(r.error))?.error
  if (quizError) return { error: quizError.message }

  const members = membersRes.data || []
  const memberName = Object.fromEntries(members.map((m) => [m.id, m.name]))
  let responses, facts, shortlists
  if (localMode) {
    const local = readLocal()
    responses = local.responses
    facts = local.facts.map((f) => ({ ...f, members: { name: memberName[f.added_by] || null } }))
    shortlists = local.shortlists.map((s) => ({ ...s, members: { name: memberName[s.created_by] || null } }))
  } else {
    responses = responsesRes.data || []
    facts = factsRes.data || []
    shortlists = shortlistsRes.data || []
  }

  return {
    localMode,
    countries: countriesRes.data || [],
    parcels: parcelsRes.data || [],
    members,
    dealbreakerPriorities: prioritiesRes.data || [],
    responses,
    facts,
    shortlists,
  }
}

export function responseToRow(memberId, response) {
  return {
    member_id: memberId,
    sliders: response.sliders || {},
    top_criteria: response.top || [],
    pairwise: response.pairwise || {},
    dealbreakers: response.dealbreakers || {},
    updated_at: new Date().toISOString(),
  }
}

export function rowToResponse(row) {
  if (!row) return null
  return { sliders: row.sliders || {}, top: row.top_criteria || [], pairwise: row.pairwise || {}, dealbreakers: row.dealbreakers || {}, updatedAt: row.updated_at }
}

export async function saveResponse({ localMode, memberId, response }) {
  const row = responseToRow(memberId, response)
  if (localMode) {
    const local = readLocal()
    const existing = local.responses.find((r) => r.member_id === memberId)
    const saved = { ...(existing || { id: localId(), created_at: row.updated_at }), ...row }
    local.responses = [...local.responses.filter((r) => r.member_id !== memberId), saved]
    writeLocal(local)
    return { data: saved }
  }
  const { data, error } = await supabase
    .from('location_quiz_responses')
    .upsert(row, { onConflict: 'member_id' })
    .select()
    .single()
  return { data, error: error?.message }
}

export async function addFact({ localMode, memberId, memberName, fact }) {
  const row = {
    target_type: fact.target_type,
    country_id: fact.target_type === 'country' ? fact.target_id : null,
    land_option_id: fact.target_type === 'parcel' ? fact.target_id : null,
    criterion: fact.criterion,
    rating: Number(fact.rating),
    value_text: fact.value_text?.trim() || null,
    source: fact.source.trim(),
    notes: fact.notes?.trim() || null,
    added_by: memberId,
  }
  if (localMode) {
    const local = readLocal()
    const saved = { ...row, id: localId(), created_at: new Date().toISOString() }
    local.facts = [saved, ...local.facts]
    writeLocal(local)
    return { data: { ...saved, members: { name: memberName } } }
  }
  const { data, error } = await supabase.from('location_facts').insert(row).select(FACT_SELECT).single()
  return { data, error: error?.message }
}

export async function deleteFact({ localMode, id }) {
  if (localMode) {
    const local = readLocal()
    local.facts = local.facts.filter((f) => f.id !== id)
    writeLocal(local)
    return {}
  }
  const { error } = await supabase.from('location_facts').delete().eq('id', id)
  return { error: error?.message }
}

export async function saveShortlist({ localMode, memberId, memberName, shortlist }) {
  const row = { ...shortlist, created_by: memberId }
  if (localMode) {
    const local = readLocal()
    const saved = { ...row, id: localId(), created_at: new Date().toISOString() }
    local.shortlists = [saved, ...local.shortlists]
    writeLocal(local)
    return { data: { ...saved, members: { name: memberName } } }
  }
  const { data, error } = await supabase.from('location_shortlists').insert(row).select('*, members(name)').single()
  return { data, error: error?.message }
}

export async function deleteShortlist({ localMode, id }) {
  if (localMode) {
    const local = readLocal()
    local.shortlists = local.shortlists.filter((s) => s.id !== id)
    writeLocal(local)
    return {}
  }
  const { error } = await supabase.from('location_shortlists').delete().eq('id', id)
  return { error: error?.message }
}
