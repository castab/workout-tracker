<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Workout Tracker Agent Guide

## Project Purpose

This is a mobile-first, single-user workout tracker for replacing a paper gym notebook. It tracks workouts, exercises, sets, and flexible metrics such as reps, weight, time, distance, and laps.

The app is inspired by the older `fitness-ui` and `fitness-backend` repositories, but this repo is a fresh full-stack rebuild.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- HyperUI-inspired copied Tailwind components
- Prisma
- PostgreSQL 18
- Docker Compose

## Development Environment

Use the checked-in `.env.development` for local development.

`npm run dev` should start the PostgreSQL 18 Docker container before starting Next.js.

Do not introduce local-only secrets into committed files. `.env.development` is only for safe development defaults.

## Database Rules

Use Prisma for database access.

The database provider is PostgreSQL. Development uses PostgreSQL 18 through Docker.

Do not add MongoDB, Spring Boot, Kotlin backend services, or a separate backend app. The goal is a single full-stack Next.js app.

## Auth Rules

The app is single-user but password protected.

Authentication should use:

- password hash stored in Postgres
- DB-backed sessions
- HTTP-only cookies

The initial user should be created by a seed script from:

- `INITIAL_USER_EMAIL`
- `INITIAL_USER_PASSWORD`

Do not hardcode production credentials.

## Data Modeling Rules

Prefer flexible set metrics over fixed fields.

A set can contain multiple metrics, such as:

- reps + weight
- time + distance
- laps + time

Avoid returning to the old `reps` + `of` model unless explicitly requested.

## UI Rules

The UI is mobile-first and gym-use-first.

Prioritize:

- fast data entry
- large tap targets
- numeric mobile keyboards where appropriate
- low-friction add/delete/edit flows
- readable workout state while standing in a gym

Use HyperUI as copy/paste design inspiration. Do not add HyperUI as a package dependency unless the project direction changes.

## Implementation Style

Prefer small, direct changes.

Use server components and server actions where practical. Use route handlers only when they are a better fit.

Keep old projects as functional/domain references, not as code to copy wholesale.
