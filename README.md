# Avalon Web

A mobile-first web app for playing Avalon: The Resistance with friends — no app install, no accounts, just share a link.

Built in a weekend after getting frustrated with every existing Avalon online site. Started with Codex, finished and polished with [Claude Code](https://claude.ai/code). Playtesters welcome — open an issue if you find bugs or have suggestions.

## Features

- Works on any phone browser — no install needed
- Private role reveal (each player sees only their own role)
- Full game phase flow: lobby → private reveal → team proposal → votes → quests → lady of the lake → assassination → end
- Quest vote reveal phase showing pass/fail result before advancing
- Realtime multiplayer via Supabase (host-authoritative sync)
- QR code + shareable invite link
- Optional roles: Mordred, Oberon, Morgana, Percival, Lady of the Lake
- Hide vote counts until reveal (house rule)
- Dark / light mode

## Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase Realtime (broadcast + presence)
- Vitest + Testing Library + Playwright

---

## Self-Hosting Guide

### Prerequisites

- Node.js 20+
- A free [Supabase](https://supabase.com) account
- A free [Cloudflare Pages](https://pages.cloudflare.com) account (or any static host)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/avalon-web.git
cd avalon-web
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Once created, go to **Project Settings → API**
3. Copy the **Project URL** and **anon public** key

No database tables are needed — the app uses Supabase Realtime channels only (broadcast + presence). No schema setup required.

### 3. Configure environment variables

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run locally

```bash
npm run dev
```

Open `http://localhost:5173`. Use room code `TESTRM` to play solo with bots.

### 5. Build for production

```bash
npm run build
```

This produces a `dist/` folder of static files.

### 6. Deploy to Cloudflare Pages (recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create → Pages
2. Upload the `dist/` folder via **Direct Upload**
3. Your app is live at `your-project.pages.dev`

Cloudflare Pages free tier has no bandwidth limits — suitable for regular game nights.

**Alternative:** Any static host works (Vercel, Netlify, GitHub Pages, nginx, etc.).

### 7. Update Supabase allowed URLs

In Supabase → **Authentication → URL Configuration**:
- Set **Site URL** to your deployed URL (e.g. `https://your-project.pages.dev`)
- Add it to **Redirect URLs** as well

### 8. Keep Supabase active (free tier)

Supabase free tier pauses projects after 7 days of inactivity. To prevent this, set up a cron job to ping your project every few days.

Free option: [cron-job.org](https://cron-job.org)
- URL: `https://your-project.supabase.co/auth/v1/health`
- Method: GET
- Schedule: every 3 days

---

## Local Development

```bash
npm run dev        # start dev server
npm run build      # production build
npm run preview    # serve built app locally
npm run test       # unit/component tests with coverage
npm run test:e2e   # Playwright mobile smoke test
```

## Game Rules Coverage

- Official Avalon team sizes for 5–10 players
- Quest 4 requires 2 fail cards for 7+ players
- Assassination modes:
  - `evil_confirm_majority_excl_oberon` (default) — evil votes to confirm before resolving
  - `official` — assassin nominates and resolves immediately
- `allowGoodFail` — when enabled, good players may submit Fail cards (off by default)
- `hideVotes` — hides vote/card counts until the reveal phase

## Trust Model

This is a friendly-play, host-authoritative implementation. The host's client resolves all game logic. It is not cheat-proof — intended for games where all players are trusted.

## Contributing / Testers Welcome

Found a bug? Something feels off with the rules? Open an issue. Pull requests welcome.

## Special Thanks

Special thanks for Hazem AlBulqini for introducing me to this game, and my friends at UMD for the countless game nights that totally remained civilized and never escalated to shouting matches when the wrong person gets accused of being evil. 
