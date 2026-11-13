# Families, and the gate in front of the app — plan

**Status: plan only. Nothing is built and nothing has been applied to the database.**
Simon needs to approve the direction, and there are four decisions at the end that are his.

Goal: The Compound stops being "Simon's app that anyone signed in can read" and becomes a tool
where **members belong to a family and see only their own family's data**, with a coming-soon
gate in front so it can be opened up later without exposing anything.

---

## 1. What the access model is today (measured, not remembered)

I queried the live database. This is worse than I described earlier and worth stating plainly.

Every pre-existing table — `land_options`, `countries`, `priorities`, `budget_contributions`,
`decisions`, `tasks` — has policies of the form:

```sql
using (auth.role() = 'authenticated')
```

That means **any signed-in user at all**. Not "any member" — they don't even need a row in
`members`. And it applies to `DELETE` as well as `SELECT`: today, any authenticated user can
delete anyone's budget contribution, priority, parcel or decision. The app's UI only shows a
delete button on your own rows, but the database does not enforce that. The three quiz tables I
added are slightly tighter (they require a member row) but follow the same "any member sees
everything" shape.

Combined with `members`' insert policy (`auth.uid() = auth_user_id`, no allow-list) and
magic-link sign-up, anyone with any email address could self-register and read and delete the
lot. Turning sign-ups off tonight is the right call and this plan is built so **they never have
to be turned back on** — see §4.

Current data: 3 auth users, 3 members, 3 countries, 1 parcel, 0 quiz rows.

---

## 2. Families

### Schema

```
families
  id uuid pk, name text not null, created_at timestamptz

members
  + family_id uuid not null references families(id)
```

Then **every** data table gets `family_id uuid not null references families(id)`, with
`default public.current_family_id()` so the app never has to send it and can never send a
wrong one:

`land_options`, `countries`, `priorities`, `budget_contributions`, `decisions`, `tasks`,
`location_quiz_responses`, `location_facts`, `location_shortlists`.

Carrying `family_id` on each row (rather than joining through `member_id` every time) keeps the
RLS policies simple and fast, and means a row can't silently change family if someone's
membership changes.

```sql
create function public.current_family_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.family_id from public.members m where m.auth_user_id = (select auth.uid()) limit 1;
$$;
```

### Policies

Two shapes, replacing all the `auth.role() = 'authenticated'` ones:

**Shared family research** — `land_options`, `countries`, `location_facts`, `location_shortlists`,
`decisions`, `tasks`. Any member of the family may read, add and edit; the row must stay in
their family.

```sql
using (family_id = (select public.current_family_id()))
with check (family_id = (select public.current_family_id()))
```

**Personal entries** — `priorities`, `budget_contributions`, `location_quiz_responses`.
Readable by the whole family (the app is built around seeing each other's priorities), but
**only the author may update or delete**. This fixes the "anyone can delete anything" hole.

### Migrating the existing data

One transaction, no orphans:

1. Create the family (name is Simon's to choose — "Gotera" as a placeholder).
2. Add `family_id` as nullable, backfill **every row in every table** to that family.
3. `set not null`, add the FK and the default.
4. Drop the old policies, create the new ones.
5. Verify: zero rows with a null `family_id` in any table, and the row counts match what was
   there before. If anything doesn't match, the transaction rolls back.

Because there is exactly one family today, nothing can be mis-assigned.

---

## 3. The gate

### Tables

| Table | What it holds | Who can touch it |
|---|---|---|
| `waitlist` | email, optional note, created_at | anon may **INSERT only** — no select, ever |
| `allowed_emails` | email → family_id | **nobody** via the API; edge function only |
| `access_codes` | family_id, label, **code hash**, expires_at, max_uses, use_count, revoked_at | **nobody** via the API |
| `access_attempts` | email, IP, outcome, created_at | **nobody** via the API |
| `invites` | email → family_id, consumed_at | **nobody** via the API |

"Nobody via the API" means no grants to `anon` or `authenticated` at all, so these are
unreachable from the browser even with a bug in a policy. Only the edge function's service role
and the SQL editor can see them.

### The flow

A visitor lands on `/` and gets the coming-soon page unless they're signed in. It offers:

- **Notify me** — email goes in `waitlist`. No access, no account, no information back about
  whether they're approved.
- **I have access** — email, plus an optional access code.

Both call one public Edge Function, `request-access`:

1. Normalise the email; look up recent `access_attempts` for this email and this IP.
2. **Rate limit:** 5 attempts per email per 15 minutes, 20 per IP per hour, then a 1-hour
   lockout. Every attempt is logged with its outcome.
3. If the email is in `allowed_emails` → granted, with that row's family.
4. Else if a code was supplied → `verify_access_code(code)`, a `SECURITY DEFINER` function that
   bcrypt-compares against the stored hash and checks expiry, revocation and `max_uses`. On
   success it increments `use_count` and returns the family.
5. On a grant: write an `invites` row, then create the auth user with the **service role** and
   send the magic link.
6. On no grant: the same generic reply either way for the email path — *"If your email is on
   the list, we've sent you a link."* A wrong **code**, by contrast, says so plainly: the code
   is the secret and rate-limiting protects it, whereas the allow-list shouldn't leak who's on it.

Signing in later is unchanged — ordinary magic link, because the user now exists.

### Joining a family

`members` loses its open INSERT policy. Instead a `SECURITY DEFINER` function
`join_my_family(name, household)` looks up the invite **by the email in the caller's JWT**,
creates the member in that family, and marks the invite consumed. The client never supplies a
`family_id`, so it can't pick one.

---

## 4. Sign-ups stay off — permanently

The brief asked when to switch "Allow new users to sign up" back on. **The answer is never**,
and that's a better outcome than the one asked for. The edge function creates users with the
service role, which is not subject to that setting. So:

- Simon turns it **off** tonight, as planned.
- It stays off forever.
- The only route to an account is: on the allow-list, or holding a valid code.

If it were left on, the gate would be decoration — anyone could skip the page and call the
Supabase auth endpoint directly from a console.

---

## 5. Making the code hard to break

| Requirement | How |
|---|---|
| Never store the code | bcrypt hash via `pgcrypto` (`crypt()` / `gen_salt('bf', 12)`). The plaintext exists only in Simon's password manager. |
| Verify server-side | A `SECURITY DEFINER` SQL function, called only by the edge function. Never compared in browser JavaScript. |
| Never exposed to the client | No `NEXT_PUBLIC_` anything. `access_codes` has no grants to `anon`/`authenticated`. |
| Hopeless to guess | 16 characters from a 31-character unambiguous alphabet (no `0/O/1/I/l`) ≈ 2⁷⁹ combinations. At the rate limit, a brute force takes longer than the universe has existed. |
| Rate limited | Per email and per IP, with lockout, in `access_attempts`. |
| Logged | Every attempt, with outcome and IP. |
| Expires | Default 90 days, and a `max_uses` cap. |
| Revocable | `revoked_at` — one UPDATE kills it. Minting a new one doesn't disturb anyone already in. |

### What a shared code costs, and what I'd recommend instead

Simon asked for a shared code and it's a reasonable choice for relatives whose email addresses
he doesn't have. But plainly:

- A shared code is **one secret held by many people**. It will end up in a family WhatsApp
  group, and group chats get forwarded, backed up and screenshotted.
- It is **not attributable** — if it leaks, the log shows which emails used it, but not who
  shared it.
- Revoking it **affects everyone** who hasn't joined yet, not just the leak.

**What I'd recommend as well as, not instead of:** per-person invite links. Same machinery —
the `invites` table already exists in this design — but each link carries a single-use random
token tied to one person. Attributable, individually revocable, and no secret to remember. The
shared code stays for the "I don't have their email" case, with a short expiry and a low
`max_uses`.

My recommendation: build both, default to invite links, keep the code as the fallback. It's
maybe an extra half-day over the code alone.

---

## 6. Where Simon types the code, and what it's called

**It is not an environment variable, and it does not go in Vercel.** Nothing about the code
belongs in the repo, in `.env`, or in any `NEXT_PUBLIC_` setting. It lives as a bcrypt hash in
one database row.

**Recommended — he never types the code at all.** In the Supabase dashboard, SQL Editor, he runs:

```sql
select * from public.mint_access_code('family-invite', 90, 25);
```

(label, days until expiry, maximum uses). The function generates a random code, stores only its
hash, and returns the plaintext **once** in the result pane. He copies it straight into his
password manager, then clears the editor tab. I never see it, it is never in git, and it is
never logged.

**If he'd rather choose a memorable code himself**, there's `set_access_code('...')` — but it's
weaker (human-chosen codes always are) and the text lands in the SQL editor's history, so he'd
want to clear that. I'd advise against it.

The only secret the edge function needs is `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects
into edge functions automatically — Simon doesn't create or paste it anywhere.

**Naming:** the code has no config key name. The row gets a `label`, which is just for the
admin list — `family-invite` is fine.

---

## 7. Also folded in

- **`rls_auto_enable` executable by anon** (flagged by Supabase's advisor): `revoke execute ...
  from public, anon, authenticated`. Honest severity: **low**. It's an event-trigger function,
  and Postgres refuses to call those directly — but there's no reason for it to be callable and
  the advisor is right to want it tidy.
- **The `DELETE`-anything hole** on the pre-existing tables, fixed by the policy rewrite above.

---

## 8. How it gets built and tested

1. Migration A — families, `family_id` everywhere, backfill, new policies. *(Verified by query
   before and after; rolls back on any mismatch.)*
2. Migration B — gate tables, `mint_access_code`, `verify_access_code`, `join_my_family`.
3. Edge function `request-access` (`verify_jwt` off, since it's called by signed-out visitors).
4. Coming-soon page, notify-me and access-code forms, en/es strings, `join_my_family` wired into
   the profile step.
5. **Testing, not just the happy path** — from a signed-out browser:
   - coming-soon page shown to a visitor; no data fetched;
   - notify-me stores an email and reveals nothing;
   - an unapproved email gets the neutral message and no account;
   - a **wrong code** is rejected, and repeated wrong codes hit the lockout;
   - a correct code creates exactly one user in the right family;
   - a second family's member cannot see the first family's rows — I'll verify this at the SQL
     level by impersonating each member, as I did for the quiz grants.

Everything is applied to the real database only with Simon's explicit go-ahead, one migration at
a time, and nothing is pushed or deployed until he's seen it work.

---

## 9. Decisions for Simon

1. **Invite links as well as the shared code?** (I recommend yes — §5.)
2. **What's the family called?** Shows in the UI; "Gotera" as a placeholder.
3. **Priorities and budget: readable by the whole family, editable only by their author** — is
   that right? It's what the UI already implies, but the database currently allows anyone to
   delete anything, so this is a real change.
4. **Does the coming-soon page say what The Compound is**, or stay vague until he's ready to
   show it publicly?
