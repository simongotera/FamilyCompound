'use client'

// Anyone in the family can hand out access here. Before this page existed, only Simon could,
// by running mint_access_code in the Supabase SQL editor.
//
// Two doors, in the order we'd rather they were used:
//   1. A link for one named person. Single use, revocable on its own, and the audit trail
//      records which email claimed it.
//   2. A shared code, for a relative you can only reach by phone. Honest about the cost: one
//      code read aloud is one code a whole group chat can keep.
//
// Nothing secret is ever fetched. A token or code exists in this page only in the seconds after
// you mint it, in the reply from the function that generated it; after a refresh it is gone for
// good, because the database kept only a bcrypt hash.

import { useEffect, useState } from 'react'
import Gate from '@/components/Gate'
import { Loading, ErrorState } from '@/components/Loading'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import {
  listInvites, createInviteLink, createAccessCode, revokeInvite, inviteUrl, daysLeft,
} from '@/lib/invites'

const EXPIRY_CHOICES = [7, 30, 90]
const USE_CHOICES = [1, 3, 5, 10, 25]

function Card({ children }) {
  return (
    <div className="rounded-lg border p-5" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
      {children}
    </div>
  )
}

// "1 days left" reads like a bug, so the last day gets its own phrasing.
function remaining(expiresAt, t) {
  const days = Math.max(daysLeft(expiresAt), 0)
  return t(days === 1 ? 'invite.oneDayLeft' : 'invite.daysLeft', { days })
}

function StatusPill({ status, label }) {
  const tone = { live: 'var(--pine)', used: '#8a8a8a', expired: '#8a8a8a', revoked: 'var(--clay)' }[status]
  return (
    <span className="text-xs rounded-full px-2 py-0.5 border" style={{ color: tone, borderColor: tone }}>
      {label}
    </span>
  )
}

// Shown once, right after minting. Deliberately loud about the fact that it won't come back.
function SecretPanel({ title, value, secondary, onDone, t }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Clipboard access can be refused; the value is on screen and selectable either way.
      setCopied(false)
    }
  }

  return (
    <div className="rounded-lg border p-5" style={{ background: 'var(--card)', borderColor: 'var(--pine)' }}>
      <h3 className="font-display text-lg mb-1" style={{ color: 'var(--pine-dark)' }}>{title}</h3>
      <p className="text-sm mb-3" style={{ color: 'var(--clay)' }}>{t('invite.onceOnly')}</p>
      <p
        className="font-mono text-sm break-all rounded px-3 py-2 mb-3 border select-all"
        style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}
      >
        {value}
      </p>
      {secondary && <p className="text-sm mb-3" style={{ color: 'var(--ink)' }}>{secondary}</p>}
      <div className="flex gap-2">
        <button
          type="button" onClick={copy}
          className="rounded-full px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--pine)', color: 'var(--card)' }}
        >
          {copied ? t('invite.copied') : t('invite.copy')}
        </button>
        <button
          type="button" onClick={onDone}
          className="rounded-full px-4 py-2 text-sm font-medium border"
          style={{ borderColor: 'var(--line)', color: 'var(--pine-dark)' }}
        >
          {t('invite.hide')}
        </button>
      </div>
    </div>
  )
}

function InvitePage() {
  const { t } = useLocale()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [name, setName] = useState('')
  const [inviteDays, setInviteDays] = useState(30)
  const [codeLabel, setCodeLabel] = useState('')
  const [codeDays, setCodeDays] = useState(30)
  const [codeUses, setCodeUses] = useState(5)
  const [showCodeForm, setShowCodeForm] = useState(false)

  const [busy, setBusy] = useState(null) // 'invite' | 'code' | row id
  const [formError, setFormError] = useState(null)
  const [secret, setSecret] = useState(null)

  async function load() {
    const { rows: data, errorKey } = await listInvites()
    setRows(data)
    setLoadError(errorKey ? t(errorKey) : null)
    setLoading(false)
  }

  useEffect(() => { Promise.resolve().then(load) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submitInvite(e) {
    e.preventDefault()
    setBusy('invite'); setFormError(null)
    const { invite, errorKey } = await createInviteLink({ label: name.trim(), days: inviteDays })
    setBusy(null)
    if (errorKey) { setFormError(t(errorKey)); return }
    setSecret({
      title: t('invite.linkFor', { name: invite.label }),
      value: inviteUrl(invite.token),
      secondary: t('invite.linkNote', { days: daysLeft(invite.expires_at) }),
    })
    setName('')
    load()
  }

  async function submitCode(e) {
    e.preventDefault()
    setBusy('code'); setFormError(null)
    const { code, errorKey } = await createAccessCode({
      label: codeLabel.trim(), days: codeDays, maxUses: codeUses,
    })
    setBusy(null)
    if (errorKey) { setFormError(t(errorKey)); return }
    setSecret({
      title: t('invite.codeFor', { label: code.label }),
      value: code.code,
      secondary: t('invite.codeNote', {
        people: t(code.max_uses === 1 ? 'invite.onePerson' : 'invite.nPeople', { n: code.max_uses }),
        days: daysLeft(code.expires_at),
      }),
    })
    setCodeLabel('')
    load()
  }

  async function handleRevoke(row) {
    setBusy(row.id); setFormError(null)
    const { errorKey } = await revokeInvite({ kind: row.kind, id: row.id })
    setBusy(null)
    if (errorKey) setFormError(t(errorKey))
    load()
  }

  if (loading) return <Loading />
  if (loadError) return <ErrorState message={loadError} />

  const live = rows.filter((r) => r.status === 'live')
  const past = rows.filter((r) => r.status !== 'live')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl mb-1" style={{ color: 'var(--pine-dark)' }}>
          {t('invite.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink)' }}>{t('invite.intro')}</p>
      </div>

      {secret && (
        <SecretPanel {...secret} onDone={() => setSecret(null)} t={t} />
      )}

      <Card>
        <h2 className="font-display text-xl mb-1" style={{ color: 'var(--pine-dark)' }}>
          {t('invite.personTitle')}
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--ink)' }}>{t('invite.personBlurb')}</p>
        <form onSubmit={submitInvite} className="flex flex-wrap gap-2 items-end">
          <div className="grow min-w-[12rem]">
            <label htmlFor="invite-name" className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>
              {t('invite.whoFor')}
            </label>
            <input
              id="invite-name" required value={name} maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('invite.whoForPlaceholder')}
              className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }}
            />
          </div>
          <div>
            <label htmlFor="invite-days" className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>
              {t('invite.expires')}
            </label>
            <select
              id="invite-days" value={inviteDays} onChange={(e) => setInviteDays(Number(e.target.value))}
              className="border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }}
            >
              {EXPIRY_CHOICES.map((d) => <option key={d} value={d}>{t('invite.inDays', { days: d })}</option>)}
            </select>
          </div>
          <button
            type="submit" disabled={busy === 'invite'}
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--pine)', color: 'var(--card)' }}
          >
            {busy === 'invite' ? t('invite.making') : t('invite.makeLink')}
          </button>
        </form>
      </Card>

      <Card>
        <h2 className="font-display text-xl mb-1" style={{ color: 'var(--pine-dark)' }}>
          {t('invite.codeTitle')}
        </h2>
        <p className="text-sm mb-2" style={{ color: 'var(--ink)' }}>{t('invite.codeBlurb')}</p>
        <p className="text-sm mb-4" style={{ color: 'var(--clay)' }}>{t('invite.codeWarning')}</p>
        {!showCodeForm ? (
          <button
            type="button" onClick={() => setShowCodeForm(true)}
            className="rounded-full px-4 py-2 text-sm font-medium border"
            style={{ borderColor: 'var(--line)', color: 'var(--pine-dark)' }}
          >
            {t('invite.codeReveal')}
          </button>
        ) : (
          <form onSubmit={submitCode} className="flex flex-wrap gap-2 items-end">
            <div className="grow min-w-[12rem]">
              <label htmlFor="code-label" className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>
                {t('invite.codeLabel')}
              </label>
              <input
                id="code-label" required value={codeLabel} maxLength={60}
                onChange={(e) => setCodeLabel(e.target.value)}
                placeholder={t('invite.codeLabelPlaceholder')}
                className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }}
              />
            </div>
            <div>
              <label htmlFor="code-uses" className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>
                {t('invite.uses')}
              </label>
              <select
                id="code-uses" value={codeUses} onChange={(e) => setCodeUses(Number(e.target.value))}
                className="border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }}
              >
                {USE_CHOICES.map((u) => (
                  <option key={u} value={u}>{t(u === 1 ? 'invite.onePerson' : 'invite.nPeople', { n: u })}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="code-days" className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>
                {t('invite.expires')}
              </label>
              <select
                id="code-days" value={codeDays} onChange={(e) => setCodeDays(Number(e.target.value))}
                className="border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }}
              >
                {EXPIRY_CHOICES.map((d) => <option key={d} value={d}>{t('invite.inDays', { days: d })}</option>)}
              </select>
            </div>
            <button
              type="submit" disabled={busy === 'code'}
              className="rounded-full px-4 py-2 text-sm font-medium"
              style={{ background: 'var(--clay)', color: 'var(--card)' }}
            >
              {busy === 'code' ? t('invite.making') : t('invite.makeCode')}
            </button>
          </form>
        )}
      </Card>

      {formError && <p className="text-sm" style={{ color: 'var(--clay)' }}>{formError}</p>}

      <Card>
        <h2 className="font-display text-xl mb-1" style={{ color: 'var(--pine-dark)' }}>
          {t('invite.outstandingTitle')}
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--ink)' }}>{t('invite.outstandingBlurb')}</p>
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink)' }}>{t('invite.nothingYet')}</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--line)' }}>
            {[...live, ...past].map((row) => (
              <li key={`${row.kind}-${row.id}`} className="py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium" style={{ color: 'var(--pine-dark)' }}>
                  {row.label || t('invite.unlabelled')}
                </span>
                <StatusPill status={row.status} label={t(`invite.status.${row.status}`)} />
                <span className="text-xs" style={{ color: 'var(--ink)' }}>
                  {t(row.kind === 'invite' ? 'invite.kindLink' : 'invite.kindCode')}
                  {row.kind === 'code' && row.max_uses != null &&
                    ` · ${t('invite.usedOf', { used: row.use_count, total: row.max_uses })}`}
                  {row.status === 'live' && ` · ${remaining(row.expires_at, t)}`}
                  {row.used_by_email && ` · ${t('invite.claimedBy', { email: row.used_by_email })}`}
                  {row.created_by_name
                    ? ` · ${t('invite.madeBy', { name: row.created_by_name })}`
                    : ` · ${t('invite.madeInSql')}`}
                </span>
                {row.status === 'live' && (
                  <button
                    type="button" onClick={() => handleRevoke(row)} disabled={busy === row.id}
                    className="ml-auto text-sm underline decoration-dotted underline-offset-4"
                    style={{ color: 'var(--clay)' }}
                  >
                    {busy === row.id ? t('invite.revoking') : t('invite.revoke')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export default function Page() {
  return <Gate><InvitePage /></Gate>
}
