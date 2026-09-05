# Mustan Healthcare Pharmacy — front end

Point-of-sale and inventory interface for the pharmacy. Next.js 16 (App
Router), React 19, Tailwind v4, TanStack Query.

The API lives beside this repo in `mutaan-backend`.

---

## Getting started

Start the API first — it owns the database, and the front end has nothing to
show without it. Follow `mutaan-backend/README.md`, which comes down to:

```bash
cd ../mutaan-backend
pnpm install && cp .env.example .env   # fill in DB_PASSWORD and SECRET_KEY
pnpm setup                             # creates + seeds the database
pnpm dev                               # :5000
```

Then, here:

```bash
pnpm install
cp .env.example .env.local
pnpm dev                               # http://localhost:3000
```

`.env.local` is gitignored, so **you have to create it** — a fresh clone will
not have one. Copying `.env.example` is enough; the defaults point at the API
on `127.0.0.1:5000`.

Sign in with `admin`, `sarah` or `ibrahim`, password `Pharmacy@2026`.

### Running without the API

Every service has a mock adapter backed by an in-memory store that genuinely
mutates — completing a sale really walks batches in FEFO order and writes
movement records. Useful for design work with no database running:

```
NEXT_PUBLIC_USE_MOCKS=true
```

State resets on reload. That is expected, not a bug.

---

## How requests reach the API

The browser only ever calls `/api/*` on its own origin. `next.config.ts`
rewrites that to `${API_PROXY_ORIGIN}/api/v1/*`, which keeps everything
same-origin — session cookies work and there is no CORS to configure.

The API's `{ message, success, statusCode, data }` envelope is unwrapped in one
place, `src/lib/api/http.ts`, so feature code only ever sees the payload. That
file also maps a 422 from express-validator onto `fieldErrors`, which is what
lets forms mark the offending input rather than showing one message on top.

---

## Layout

```
src/
  app/            routes; thin files, real code lives in features/
  components/ui/  design-system primitives — one way to do each thing
  components/     layout/ and shared/ pieces used across features
  features/       one folder per module; never imports another feature
  services/       one module per API resource, mock and http side by side
  lib/            money, dates, status mapping, permissions, query keys
  mocks/          seeded in-memory store used when NEXT_PUBLIC_USE_MOCKS=true
```

### Conventions worth keeping

- **Money is integer kobo** everywhere, formatted only at the edge by
  `lib/money.ts`. Never do arithmetic on a formatted string.
- **Expiry dates are `YYYY-MM-DD` strings** with day-based arithmetic in
  `lib/date.ts` — never converted through a `Date`, which can shift the day.
- **Status colours come from `lib/status.ts`**, which is the single source of
  truth. A normal sale is deliberately neutral grey, not red: routine stock
  leaving is not a problem to flag.
- **Status is never colour alone** — every badge pairs a colour with a word.
- **Fonts are self-hosted** from `@fontsource-variable/*` rather than fetched
  from Google. The pharmacy server has no internet, and the naira sign U+20A6
  lives in Inter's `latin-ext` subset, so requesting only `latin` leaves every
  ₦ drawn by a fallback face at the wrong width.
- **The server decides FEFO.** Batch allocation shown before a sale is labelled
  as expected; what a receipt prints is what the API returned.

---

## Checks

```bash
pnpm exec tsc --noEmit    # `next lint` is gone in v16 — use the CLIs directly
pnpm exec eslint .
pnpm build
```

Worth doing by hand after UI changes: a pass at **1366×768**, which is the real
terminal size and the tightest constraint in the layout, and a keyboard-only
run through the POS screen.
