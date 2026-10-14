This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment

Copy `.env.example` to `.env` and fill it in. The app needs:

| Variable                    | Used for                                              |
| --------------------------- | ----------------------------------------------------- |
| `SUPABASE_URL`              | Supabase project URL                                  |
| `SUPABASE_ANON_KEY`         | Server-side auth client (`@supabase/ssr`)              |
| `SUPABASE_SERVICE_ROLE_KEY` | Catalog reads + chat persistence (server-side only)    |
| `SUPABASE_ACCESS_TOKEN`     | `db:init` only (Supabase Management API)               |
| `DEEPSEEK_API_KEY`          | AI answers (server-side only)                          |

Everything else has a working default — see `.env.example` for the DeepSeek
model/effort overrides. No secret is ever sent to the browser: auth runs through
server actions and the Supabase client is server-only.

### Auth setup (Supabase dashboard)

In **Authentication → URL Configuration** add the callback to *Redirect URLs*:

```
http://localhost:3000/auth/callback
```

Sign-in is email/password plus Google OAuth. For Google, enable the provider in
**Authentication → Providers** and paste the client id/secret from Google Cloud
Console (the authorised redirect URI is
`https://<project-ref>.supabase.co/auth/v1/callback`).

### Chat tables

`chats` and `chat_messages` live in the same database as the catalog. They are
created by `supabase/migrations/0001_chats.sql` (apply with `npm run db:init`)
and documented in [DATABASE_USAGE.md](./DATABASE_USAGE.md). Both have RLS
enabled; the data layer always scopes by `user_id`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
