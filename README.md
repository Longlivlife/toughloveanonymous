# Tough Love Anonymous — Local Dev Setup

## Prerequisites
- Node.js 18+ installed
- Your Supabase anon key (from Supabase project settings → API)
- Your Anthropic API key

## First-time setup

```bash
cd app
npm install
cp .env.example .env.local
```

Then open `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
ANTHROPIC_API_KEY=your_actual_anthropic_key
```

The Supabase URL is already pre-filled with the toughloveanonymous project URL.

## Run locally

```bash
npm run dev
```

Open http://localhost:3000

## Full user flow

```
/ → smart redirect based on auth state
    ├── not logged in → /auth (magic link email)
    │                       ↓ click link in email
    │                   /auth/callback (exchanges code for session)
    │                       ↓
    ├── logged in, no consent → /consent (read + check boxes + submit)
    │                               ↓ writes to consent_records + survivors
    └── logged in + consented → /companion (AI conversation)
                                     ↓ auto-saves transcript to testimonies every 5s
```

## What's built

- [x] Magic link auth (Supabase OTP)
- [x] Auth callback handler
- [x] Route middleware (protect all non-auth routes)
- [x] Consent flow with versioned consent text
- [x] Consent API — writes immutable consent_records + survivors rows
- [x] IP hashing for audit trail (SHA-256, never raw IP stored)
- [x] Companion conversation UI
- [x] Claude API route (server-side, key never exposed to client)
- [x] Trauma-informed system prompt live
- [x] Auto-save transcript to testimonies table (debounced 5s)
- [x] Testimony ID tracked across session for append behavior

## What's not built yet (Phase 3)

- [ ] Survivor dashboard (view + manage testimony)
- [ ] Testimony review + submission flow
- [ ] Program intake (which program, entry/exit year, age at entry)
- [ ] Attorney/researcher access portal
- [ ] Search interface

## Supabase config needed

In your Supabase project → Authentication → URL Configuration:
- Site URL: http://localhost:3000 (local) / https://toughloveanonymous.com (production)
- Redirect URLs: http://localhost:3000/auth/callback

## Deploy to Vercel

1. Push this repo to GitHub
2. Import in Vercel, set root directory to `app`
3. Add environment variables in Vercel dashboard
4. Point toughloveanonymous.com at Vercel via Cloudflare

## File structure

```
app/
  src/
    middleware.ts               → auth protection for all routes
    app/
      page.tsx                  → smart redirect based on auth/consent state
      layout.tsx                → root layout
      globals.css               → Tailwind base
      auth/
        page.tsx                → magic link email form
        callback/
          route.ts              → Supabase auth code exchange
      consent/
        page.tsx                → consent flow UI + choices
      companion/
        page.tsx                → companion UI (auth + consent gated)
      api/
        companion/
          route.ts              → Claude API (server-side)
        consent/
          route.ts              → saves consent_records + survivors
        session/
          route.ts              → saves/appends to testimonies
    lib/
      companion-prompt.ts       → full system prompt
      supabase.ts               → browser + server Supabase clients
```
