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

`npm run dev` starts the local PostgreSQL 18 container before starting Next.js.

Development login defaults after seeding:

```text
Email: admin@example.com
Password: password
```

## Getting Started

1. Install dependencies.

```bash
npm install
```

2. Start the development server and database.

```bash
npm run dev
```

3. In a second terminal, run the initial database migration and seed the first user if needed.

```bash
npm run prisma:migrate
npm run db:seed
```

4. Open the app.

```text
http://localhost:3000
```

## Database

The development database runs in Docker using PostgreSQL 18.

Useful commands:

```bash
npm run db:up
npm run db:down
npm run prisma:migrate
npm run prisma:generate
npm run prisma:studio
npm run db:seed
```

`npm run prisma:generate` writes the generated Prisma client to `lib/generated/prisma` as configured in `prisma/schema.prisma`.

## Authentication

The app is single-user and password protected.

The initial user is created by the seed script using:

```env
INITIAL_USER_EMAIL
INITIAL_USER_PASSWORD
```

For development, `.env.development` contains safe defaults. Production deployments should provide their own secrets through the hosting environment.

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

## Code Layout

- `app/page.tsx` lists recent workouts and starts new workouts.
- `app/login` contains the sign-in page and login/logout server actions.
- `app/workouts/actions.ts` contains workout, exercise, and set server actions.
- `app/workouts/[workoutId]` contains the active/completed workout screen and its client-side editors.
- `lib/auth.ts` manages DB-backed sessions and the HTTP-only session cookie.
- `lib/prisma.ts` creates the Prisma client using `@prisma/adapter-pg`.
- `prisma/schema.prisma` contains the PostgreSQL data model.
- `prisma/seed.ts` creates or updates the initial user from environment variables.

## Project History

This project is a full-stack rebuild based on two older repositories:

- [`fitness-ui`](https://github.com/castab/fitness-ui)
- [`fitness-backend`](https://github.com/castab/fitness-backend)

Those projects used a separate frontend/backend architecture with Next.js, Kotlin Spring Boot, and MongoDB. This app keeps the same core purpose of replacing a paper gym notebook, but merges the concept into one full-stack Next.js application backed by Prisma and PostgreSQL.
