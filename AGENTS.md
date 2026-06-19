<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Workout Tracker Agent Guide

## Project Purpose

This is a mobile-first, single-user workout tracker for replacing a paper gym notebook. It tracks workouts, exercises, sets, and flexible metrics such as reps, weight, time, distance, and laps.

The app is inspired by the older `fitness-ui` and `fitness-backend` repositories, but this repo is a fresh full-stack rebuild.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- HyperUI-inspired copied Tailwind components
- Prisma 7
- PostgreSQL 18
- Docker Compose

## Development Environment

Use the checked-in `.env.development` for local development.

`npm run dev` should start the PostgreSQL 18 Docker container before starting Next.js.

Do not introduce local-only secrets into committed files. `.env.development` is only for safe development defaults.

Run local database commands through the package scripts so `.env.development` is loaded consistently:

- `npm run prisma:migrate`
- `npm run prisma:generate`
- `npm run prisma:studio`
- `npm run db:seed`

The auth user is created automatically with a generated password when no user exists. The initial password is logged server-side only on that first creation.

## Database Rules

Use Prisma for database access.

The database provider is PostgreSQL. Development uses PostgreSQL 18 through Docker.

This project uses Prisma 7 with `@prisma/adapter-pg`. The generated Prisma client is intentionally configured in `prisma/schema.prisma` with:

- `provider = "prisma-client"`
- `output = "../lib/generated/prisma"`

Import app code from `@/lib/prisma` rather than creating ad hoc Prisma clients. Import Prisma-generated types from `@/lib/generated/prisma/client` when needed.

Do not add MongoDB, Spring Boot, Kotlin backend services, or a separate backend app. The goal is a single full-stack Next.js app.

## Auth Rules

The app is single-user but password protected.

Authentication should use:

- password hash stored in Postgres
- DB-backed sessions
- HTTP-only cookies

Current session cookie name is `workout_tracker_session`. Session tokens are random values stored in the browser and SHA-256 hashes stored in the database.

The auth user is created automatically when no user exists. No username is used. Change the generated password from the settings page after first login.

Do not hardcode production credentials.

## Data Modeling Rules

Prefer flexible set metrics over fixed fields.

A workout has ordered `WorkoutExercise` entries, each entry references a reusable `Exercise`, and each `ExerciseSet` has one or more `SetMetric` rows.

A set can contain multiple metrics, such as:

- reps + weight
- time + distance
- laps + time

Avoid returning to the old `reps` + `of` model unless explicitly requested.

Current metric enum values are `REPS`, `WEIGHT`, `TIME`, `DISTANCE`, and `LAPS`. Current unit enum values are `COUNT`, `LB`, `KG`, `SECONDS`, `MINUTES`, `METERS`, `KM`, `MILES`, and `LAPS`.

## UI Rules

The UI is mobile-first and gym-use-first.

Prioritize:

- fast data entry
- large tap targets
- numeric mobile keyboards where appropriate
- low-friction add/delete/edit flows
- readable workout state while standing in a gym

Use HyperUI as copy/paste design inspiration. Do not add HyperUI as a package dependency unless the project direction changes.

Completed workouts are read-only in the UI. Active workouts support adding/removing exercises, editing exercise names, and adding/updating/deleting set entries.

## Implementation Style

Prefer small, direct changes.

Use server components and server actions where practical. Use route handlers only when they are a better fit.

This app uses Next.js 16 App Router conventions. Route `params` and `searchParams` are promises in current pages; follow the existing pattern and read the relevant docs in `node_modules/next/dist/docs/` before changing framework-facing code.

Keep server actions in `app/workouts/actions.ts` or the relevant route segment unless there is a clear reason to split them.

Use `revalidatePath` after mutations that should refresh visible server-rendered data. Use `redirect` after creates when the UI should focus or navigate.

Keep old projects as functional/domain references, not as code to copy wholesale.

## Current Code Map

- `app/page.tsx`: authenticated home page, active workout link, recent workouts, logout.
- `app/login/page.tsx` and `app/login/actions.ts`: sign-in and logout flow.
- `app/workouts/actions.ts`: create/finish workout, exercise entry mutations, set mutations.
- `app/workouts/[workoutId]/page.tsx`: active/completed workout view and exercise suggestions query.
- `app/workouts/[workoutId]/*-editor.tsx`: client-side editing affordances.
- `lib/auth.ts`: session creation, lookup, deletion, and `requireUser`.
- `lib/prisma.ts`: shared Prisma client.
- `prisma/schema.prisma`: source of truth for the database model.
- `prisma/seed.ts`: initial user seed.
