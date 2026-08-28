# Crownline Motors

Vehicle dealership & import platform for South Sudan, sourcing from Japan and Korea.

## Stack
Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Prisma · Supabase (Postgres, Auth, Storage) · Zod · Vitest · Playwright

## Getting started
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in values
3. `npx prisma migrate dev`
4. `npm run db:seed` — creates the `BusinessSettings` singleton the app needs
5. `npm run dev`

## Administrators

There is no sign-up page, and there never will be. Self-signup is disabled in
the Supabase dashboard, and administrators are provisioned from a terminal by
someone who already holds the project's secret key:

```bash
npm run admin:create -- --email=you@example.com --name="Your Name"
```

Wave A has one role, `ADMIN`, which holds every permission. Separation of
duties only means something with more than one person, and Crownline launches
with a single operator (the roadmap's Stage 6 allows exactly this).

The permission layer itself is still in place — every page and action names the
permission it needs, and `src/lib/auth/permissions.ts` maps roles to
permissions. Adding a restricted role later is three edits (enum value,
permission list, label), two of which the compiler will demand. No call site
changes, because no call site names a role.

The invited person receives an email, follows it to `/auth/confirm`, and chooses
their own password. No password is ever set, transmitted or printed by the
script. They then sign in at `/admin/login`.

Administrators are **deactivated, never deleted** (`AdminProfile.isActive`), so
that the payment and tracking records attributed to them keep their author.

### Working in a GitHub Codespace

Two things need the forwarded `…app.github.dev` origin rather than `localhost`,
and both are handled automatically by reading the variables Codespaces injects:

- **`admin:create` / `admin:reset-link`** build their links against it, so an
  emailed or printed link points somewhere reachable.
- **`next.config.ts`** adds it to `serverActions.allowedOrigins`. Without that,
  Next.js's Server Action CSRF check sees the forwarded origin, compares it to
  its own host, and rejects every form submission as forged — the symptom is
  *"Invalid Server Actions request"* on sign-in or password reset.

Both are scoped to that one origin and disabled in production. Do not widen
either to a wildcard.

### If an invitation or reset email link fails

Supabase verifies the token **before** redirecting, so following a link to an
unreachable address consumes it. The account ends up confirmed with no password
anyone knows, and that link cannot be retried.

Recover without email:

```bash
npm run dev                                   # the link must have somewhere to land
npm run admin:reset-link -- --email=you@example.com
```

It prints a reset URL built against every origin this app might be reachable on
— open whichever one your browser can actually get to. The link points straight
at `/auth/confirm`, bypassing Supabase's redirect allow-list, so no dashboard
change is needed. It is single-use and time-limited: **treat it as a password.**

This is also the answer to "how do we recover an admin account?" for handover
(Stage 43).

### Supabase settings this depends on

| Setting | Required value |
|---|---|
| Authentication → Providers → Email → *Allow new users to sign up* | **off** |
| Authentication → URL Configuration → Site URL | your deployed origin |
| Authentication → URL Configuration → Redirect URLs | must include every origin used, including `http://localhost:3000` for local work |

`NEXT_PUBLIC_SITE_URL` must be set in production — it is the origin embedded in
authentication emails, and the code refuses to derive it from request headers
there. See the note in `.env.example`.

## How authorisation works

Read `src/lib/auth/dal.ts` before touching anything under `/admin`. The short
version:

- **`proxy.ts`** refreshes the session and redirects anonymous visitors away
  from `/admin`. This is convenience, not security.
- **`src/lib/auth/dal.ts`** verifies the JWT and resolves it to an *active*
  `AdminProfile`. This is the boundary.
- **Every admin page** calls `requireAdmin()` / `requirePermission()`.
  **Every admin action** calls `authorizeAdmin()` / `authorizePermission()`.
  A layout check is not sufficient in the App Router and must not be relied on.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run typecheck` | Route typegen + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit suite |
| `npm run test:e2e` | Playwright |
| `npm run db:migrate` | Prisma migrations |
| `npm run db:seed` | Seed `BusinessSettings` |
| `npm run admin:create` | Provision an administrator |

## Project status
Wave A (Phase 1 — Vehicle Dealership) — in progress.
Phases 0–3 complete: foundation, database, design system and public shell,
authentication and authorisation.
See `CLAUDE.md` for the full master development plan and `SECURITY.MD` for the
production security specification.
