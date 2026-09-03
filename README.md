# Crownline Motors

Vehicle dealership & import platform for South Sudan, sourcing from Japan and Korea.

## Stack
Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Prisma · Supabase (Postgres, Auth, Storage) · Zod · Vitest · Playwright

## Getting started
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in values
3. `npx prisma migrate dev`
4. `npm run db:seed` — creates the `BusinessSettings` singleton the app needs
5. `npm run storage:setup` — creates the Supabase Storage bucket vehicle
   photographs are uploaded to. Idempotent; an existing bucket is left alone.
   Skip it and the first photo upload fails with "Bucket not found".
6. `npm run dev`

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
script. They then sign in at the dashboard's login page.

### Where the dashboard lives

Not at `/admin`. The base path is `ADMIN_BASE_PATH` in
`src/lib/constants/admin-routes.ts`, and it is mirrored by the folder name
under `src/app/(admin)/` — `tests/unit/admin-routes.test.ts` fails if the two
ever disagree. Build every internal link with `adminPath("/…")` rather than
writing the segment out.

Moving the dashboard off `/admin` removes it from the automated scanner
traffic that probes that path on every site on the internet. It is **not** an
access control, and nothing about the real one changed — see below. For the
same reason the path is deliberately absent from `robots.txt`: publishing it
there would hand it back to exactly those scanners.

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

Read `src/lib/auth/dal.ts` before touching anything under the admin base path.
The short version:

- **`proxy.ts`** refreshes the session and redirects anonymous visitors away
  from the dashboard. This is convenience, not security.
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
| `npm run storage:setup` | Create the Supabase Storage buckets |

## Project status
Wave A (Phase 1 — Vehicle Dealership) — in progress.

Phases 0–8 complete:

- **0–2** foundation, database schema, design system and public shell
- **3** authentication and authorisation
- **4** admin dashboard shell
- **5** vehicle inventory — create/edit/status, photograph management
  (upload, main image, ordering, descriptions, removal)
- **6** public vehicle marketplace — `/cars` and the vehicle detail page
- **7** search and filtering — make, model and year, each usable alone and
  all three combinable
- **8** contextual WhatsApp, with the number configured in the dashboard

`listVehicles` and `getVehicleById` in `src/lib/queries/vehicle.queries.ts`
deliberately return **every** status, archived included, because the admin
list needs that. The public side must never reuse them: it has its own
`PUBLISHED`-only reads in `public-vehicle.queries.ts`, all funnelled through
`publicVehicleWhere`, and `tests/unit/public-vehicle-visibility.test.ts`
fails if a customer-facing route imports the admin module.

Next: Phase 10 onward — customers, quotes, orders, payments and tracking.
`/track-my-order` is still a placeholder rendering a bare `<main />` inside
the real header/footer shell.

### Search and filtering

The whole search lives in the query string and is re-parsed by
`vehicleSearchSchema` on every request, so a filtered catalogue is a real
address that survives a refresh, a bookmark and a WhatsApp forward. Parsing
is forgiving by design — junk degrades to "unfiltered", never to an error
page. The dropdown options come from `listVehicleFacets`, which returns the
distinct published make/model/year combinations, so a customer cannot
assemble a search that was never going to match anything.

Adding one of the brief's remaining filters (price, mileage, fuel,
transmission, drive, location) is a field on `vehicleSearchSchema`, a clause
in `vehicleSearchWhere`, and a control on the filter bar. Nothing else moves.

### WhatsApp

The number is `BusinessSettings.whatsappNumber`, edited in the dashboard
under Settings — never hard-coded into a page. `getWhatsAppNumber()` reads it
through a tagged cache so public pages stay statically renderable, and
`updateBusinessSettingsAction` calls `updateTag` so a change is live
immediately. `NEXT_PUBLIC_WHATSAPP_NUMBER` is only a fallback for the window
before an operator first opens Settings; if both are empty every WhatsApp
call to action renders nothing rather than a broken link.

Messages are contextual: the vehicle page pre-fills the make, model and
listing reference, and `src/lib/utils/whatsapp.ts` also holds the spare-part,
order and tracking builders for the pages that will carry them. Everywhere
else — the floating button, the footer, the mobile drawer — sends the general
enquiry.

### Sign-in rate limiting

Seven attempts per fifteen minutes, counted per email address **and** per
client IP, in `src/lib/auth/rate-limit.ts`. Backed by the `LoginAttempt`
table rather than an in-memory counter, because on Vercel each request may
be served by a different instance and a `Map` would give an attacker seven
tries per instance. Identifiers are hashed before they are stored, so the
table is not a list of staff addresses and the IPs they work from.

Note the shared-IP consequence: administrators behind one office NAT share
the IP budget. That is the intended trade at this scale — the lockout is
fifteen minutes, and an address that has produced seven failures in that
window is worth pausing either way.

See `CLAUDE.md` for the full master development plan and `SECURITY.MD` for the
production security specification.
