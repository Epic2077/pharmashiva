# PharmaShiva

AI-assisted pharmacy consultations. Describe a case and get a deterministic
red-flag safety assessment, an evidence-based explanation streamed from
DeepSeek, and product cards grounded in the live [Darukade](https://darukade.com)
catalog — in English or Farsi. Chats are saved per user with full history.

Built with [Next.js](https://nextjs.org) (App Router), React 19, Tailwind CSS 4,
Base UI/shadcn components, Supabase (auth + chat storage) and the DeepSeek API.

## Getting Started

1. Install dependencies and configure the environment:

   ```bash
   npm install
   cp .env.example .env   # then fill in the values
   ```

2. Create the database tables (requires `SUPABASE_URL` + `SUPABASE_ACCESS_TOKEN`):

   ```bash
   npm run db:init
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) — the landing page routes to
`/home/chat`, the main consultation UI. You can edit `app/page.tsx`; the page
auto-updates as you save.

Fonts (Manrope, Roboto, Vazirmatn for Persian/RTL text) are optimized via
[`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts).

## Environment

Copy `.env.example` to `.env` and fill it in. The app needs:

| Variable                    | Used for                                                    |
| --------------------------- | ----------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase project URL (auth + data)                          |
| `SUPABASE_ANON_KEY`         | Server-side auth client (`@supabase/ssr`)                   |
| `SUPABASE_SERVICE_ROLE_KEY` | Chat persistence + `darukade:sync` writes (server-side only) |
| `SUPABASE_ACCESS_TOKEN`     | `db:init` only (Supabase Management API)                    |
| `DEEPSEEK_API_KEY`          | AI answers (server-side only)                               |

Everything else has a working default — see `.env.example` for the DeepSeek
model/effort overrides (`DEEPSEEK_MODEL`, `DEEPSEEK_PRO_MODEL`,
`DEEPSEEK_REASONING_EFFORT`, timeouts) and `lib/darukade/config.ts` for the
optional `DARUKADE_*` connector tunables (timeout, retries, concurrency,
request pacing). No secret is ever sent to the browser: auth runs through
server actions and the Supabase client is server-only.

Without `DEEPSEEK_API_KEY` the chat still returns the deterministic safety
assessment and live catalog products; only the AI text degrades to a fallback.

### Auth setup (Supabase dashboard)

In **Authentication → URL Configuration** add the callback to *Redirect URLs*:

```
http://localhost:3000/auth/callback
```

Sign-in is email/password plus Google OAuth. For Google, enable the provider in
**Authentication → Providers** and paste the client id/secret from Google Cloud
Console (the authorised redirect URI is
`https://<project-ref>.supabase.co/auth/v1/callback`).

`proxy.ts` (Next 16's middleware) refreshes the session cookie and bounces
signed-out users away from `/home` and `/setting`; every server action and API
route still verifies the caller itself.

## Data

- **Chats** — `chats` and `chat_messages` live in the same database as auth.
  They are created by `supabase/migrations/0001_chats.sql` (plus
  `0003_chat_memory.sql` for the per-chat case memory column) and applied with
  `npm run db:init`. Both have RLS enabled; the data layer always scopes by
  `user_id`.
- **Products** — not stored in Supabase. The catalog is fetched live from
  Darukade by the server-side connector in `lib/darukade` (listing search,
  structured product details, category tree). See
  [DATABASE_USAGE.md](./DATABASE_USAGE.md) for the architecture and latency
  rules. `npm run darukade:sync` can optionally mirror the catalog into
  Supabase for offline/analysis use.

## Scripts

| Command                                     | Purpose                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev` / `build` / `start`           | Next.js development server / production build / serve              |
| `npm run lint`                              | ESLint                                                             |
| `npm test`                                  | Node test runner (`node --test`) — see below                       |
| `npm run db:init`                           | Apply every file in `supabase/migrations/` via the Management API. Pass a prefix to filter: `npm run db:init -- 0001` |
| `npm run darukade:sync -- <mode>`           | Catalog sync CLI: `discover`, `enrich`, `product`, `related`, `full`, `status`, `stats` (supports `--dry-run`) |
| `npm run check:imports`                     | Verify every local import resolves with exact filename case (CI/case-sensitive hosts) |

## How a chat turn works

1. **Interpret** — the message is parsed into structured case facts (JSON mode).
2. **In parallel:** the deterministic red-flag engine (`lib/safety`) assesses
   urgency, and product retrieval queries Darukade with bounded concurrency.
3. **Suggest** — product retrieval always returns cards (best-effort even when
   the relevance gate can't confirm a match), while the deterministic safety
   result is shown as its own alert above them. The model can never override or
   downgrade the safety result, and it never withholds the cards.
4. **Compose** — the answer streams as NDJSON events (`/api/chat`): stage
   status, thinking deltas, safety, products, then text.

Per-chat case memory accumulates facts across turns so follow-ups stay
attributed to the right problem.

## Testing

```bash
npm test
```

Runs entirely offline (no model, no network) against fixtures: safety
assessment semantics, safety events, model concerns, the relevance gate,
product emission, retrieval integration with mocked Darukade responses, and
interpretation validation. A regression here is a safety regression.

## Project layout

- `app/` — routes, pages and API handlers (`/home/chat`, `/search`,
  `/categories`, `/home/history`, `/setting`, `/api/*`)
- `components/` — UI (chat, products, search, auth, shadcn/Base UI primitives)
- `lib/ai/` — interpretation, prompts, DeepSeek client, retrieval pipeline
- `lib/safety/` — deterministic red-flag rules engine
- `lib/darukade/` — catalog connector (server-side only)
- `lib/chats/`, `lib/auth/` — chat persistence and auth server actions
- `supabase/migrations/` — SQL applied by `npm run db:init`
- `scripts/`, `tests/` — sync/CLI tooling and the offline test suite

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) — features and API
- [Learn Next.js](https://nextjs.org/learn) — interactive tutorial
- [Next.js GitHub repository](https://github.com/vercel/next.js)

## Deploy on Vercel

The easiest way to deploy is the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).
Set every variable from the Environment table above in the project settings
(they are all server-side; none require a `NEXT_PUBLIC_` prefix). See the
[Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying)
for more details.
