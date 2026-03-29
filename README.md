# Avalon Web

Mobile-first web app for Avalon with browser-only room play and Supabase Realtime synchronization.

## Stack
- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase Realtime channels (broadcast + presence)
- Vitest + Testing Library + Playwright

## Local Development
```bash
npm install
npm run dev
```

## Environment
Create `.env.local`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Without these, app runs in local-only mode on one device.

## Scripts
- `npm run dev` start dev server
- `npm run build` build production bundle
- `npm run preview` serve built app
- `npm run test` run unit/component tests with coverage
- `npm run test:e2e` run Playwright mobile smoke test

## Rules Coverage
Canonical rule matrix and role behavior are documented in [`docs/rules.md`](docs/rules.md).

## Assassination Modes
- `evil_confirm_majority_excl_oberon` (default): evil confirmation vote after assassin nomination.
- `official`: assassin nomination resolves immediately.

## Quest Vote Rule
- `allowGoodFail` (default: `true`): when enabled, good players may submit `Fail` cards.
- Host can toggle this in lobby rules before game start.

## Trust Model
This v1 is friendly-play host-authoritative sync and is not cheat-proof.
