# The Compound

A shared tool for tracking our family's homestead search — comparing land options, logging everyone's priorities and dealbreakers, tracking the budget, and keeping a record of decisions and tasks.

## Stack
- **Next.js** (frontend + backend)
- **Supabase** (Postgres database + auth)
- **Vercel** (hosting)

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll need a `.env.local` file with your Supabase project URL and anon/publishable key (see `.env.local.example`).

## Deployment

Deployed via Vercel, connected to this repo. Environment variables are set in the Vercel project settings, not committed to git.
