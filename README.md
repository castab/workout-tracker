# Workout Tracker

A mobile-first, single-user workout tracker for replacing a paper gym notebook. The app tracks workouts, exercises, sets, and flexible metrics such as reps, weight, time, distance, and laps.

## Current App

- Password-protected single-user login.
- Recent workout list with one-tap workout creation.
- Active workout screen for adding exercises and quick set entries.
- Exercise suggestions based on the last 90 days of workout history.
- Editable exercise names and set metrics while a workout is active.
- Completed workouts are read-only.
- Workouts cannot be finished until every exercise has at least one set.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- HyperUI-inspired copied Tailwind patterns
- Prisma 7
- PostgreSQL 18
- Docker Compose

## Development Requirements

- Node.js
- npm
- Docker Desktop or a compatible Docker runtime

## Development Environment

This project uses a checked-in `.env.development` for local development defaults. These values are intentionally non-production credentials for the local Docker database.

Database connection variables are split by purpose:

- `POSTGRES_PRISMA_URL` is used by the running app for normal database operations.
- `POSTGRES_URL_NON_POOLING` is used by Prisma migrations.

For local development, both variables point at the same Docker Postgres database.

`npm run dev` starts the local PostgreSQL 18 container before starting Next.js.

Use `npm run pwa:dev` when testing installability, service worker behavior, or offline sync locally. It starts the same database container, enables service worker registration, and runs Next.js with `--experimental-https` at `https://localhost:3000`.

On first setup, the app creates the password holder automatically and prints a strong initial password in the server logs. The password is only logged when no auth user exists.

## Getting Started

1. Install dependencies.

```bash
npm install
```

2. Start the development server and database.

```bash
npm run dev
```

3. In a second terminal, run the initial database migration.

```bash
npm run prisma:migrate
```

4. Open the app.

```text
http://localhost:3000
```

## Database

The development database runs in Docker using PostgreSQL 18.

Prisma migrations use `POSTGRES_URL_NON_POOLING`; the app runtime and seed script use `POSTGRES_PRISMA_URL`.

Useful commands:

```bash
npm run db:up
npm run db:down
npm run pwa:dev
npm run prisma:migrate
npm run prisma:generate
npm run prisma:studio
npm run db:seed
```

`npm run prisma:generate` writes the generated Prisma client to `lib/generated/prisma` as configured in `prisma/schema.prisma`.

## Authentication

The app is single-user and password protected.

The auth user is created automatically on first visit to the login page when no user exists. A strong generated password is printed once in the server logs. After signing in, use Settings to change the password.

`npm run db:seed` is optional and uses the same behavior: it creates and logs a generated password only when no auth user exists.

## Data Model

The app uses a flexible metric model rather than fixed set fields.

A workout contains ordered workout exercise entries. Each entry points at a reusable exercise name and contains ordered sets. Each set contains one or more metrics.

Supported metric types and units are defined in `prisma/schema.prisma`:

- `REPS` with `COUNT`
- `WEIGHT` with `LB` or `KG`
- `TIME` with `SECONDS` or `MINUTES`
- `DISTANCE` with `METERS`, `KM`, or `MILES`
- `LAPS` with `LAPS`

Example metric combinations:

- reps + weight
- reps only
- time only
- distance + time
- laps + time

## UI Direction

The app is mobile-first because it is primarily used during workouts at the gym. UI patterns should prioritize fast data entry, large tap targets, and low-friction editing.

HyperUI is used as design inspiration through copied Tailwind patterns, not as an installed UI package.

## PWA Support

The app is installable as a PWA and includes offline support for gym dead zones.

- The web app manifest, icons, theme color, and service worker make the app installable from supported browsers.
- Recently visited same-origin pages are cached with a network-first strategy, so previously opened workout pages can be viewed offline.
- Active workout edits use an IndexedDB-backed mutation queue for add/edit/delete set and exercise changes while offline.
- Queued workout changes sync back to Postgres through `/api/workouts/[workoutId]/sync` when connectivity returns.
- Offline sync is intentionally scoped to active workout entry. Login, password changes, and first-time auth bootstrap still require the server.
- Logging out or changing the password redirects to `/login`, where the client asks the service worker to clear cached authenticated pages.

Operational notes:

- Install from a production HTTPS deployment for the best Android/iOS PWA behavior.
- For local PWA testing, use `npm run pwa:dev` and open `https://localhost:3000` so browser PWA APIs run in a secure context.
- Normal `npm run dev` does not register the service worker; this avoids stale development caches while working on non-PWA features.
- If a browser keeps an old service worker, close all app tabs and reopen the installed app after deploying a new service worker version.
- If sync fails, queued changes remain in IndexedDB and retry when the app is online again.
- Push notifications are intentionally not implemented; the app does not request notification permission or require VAPID keys.

## Code Layout

- `app/page.tsx` lists recent workouts and starts new workouts.
- `app/login` contains the sign-in page and login/logout server actions.
- `app/workouts/actions.ts` contains workout, exercise, and set server actions.
- `app/workouts/[workoutId]` contains the active/completed workout screen and its client-side editors.
- `lib/auth.ts` manages DB-backed sessions and the HTTP-only session cookie.
- `lib/prisma.ts` creates the Prisma client using `@prisma/adapter-pg`.
- `prisma/schema.prisma` contains the PostgreSQL data model.
- `prisma/seed.ts` optionally creates the auth user with a generated password.

## Project History

This project is a full-stack rebuild based on two older repositories:

- [`fitness-ui`](https://github.com/castab/fitness-ui)
- [`fitness-backend`](https://github.com/castab/fitness-backend)

Those projects used a separate frontend/backend architecture with Next.js, Kotlin Spring Boot, and MongoDB. This app keeps the same core purpose of replacing a paper gym notebook, but merges the concept into one full-stack Next.js application backed by Prisma and PostgreSQL.
