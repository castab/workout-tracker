# Workout Tracker

A mobile-first, single-user workout tracker for replacing a paper gym notebook. The app tracks workouts, exercises, sets, and flexible metrics such as reps, weight, time, distance, and laps.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- HyperUI-inspired UI components
- Prisma
- PostgreSQL 18
- Docker Compose

## Development Requirements

- Node.js
- npm
- Docker Desktop or a compatible Docker runtime

## Development Environment

This project uses a checked-in `.env.development` for local development defaults. These values are intentionally non-production credentials for the local Docker database.

`npm run dev` starts the local PostgreSQL 18 container before starting Next.js.

## Getting Started

1. Install dependencies.

```bash
npm install
```

2. Start the development server and database.

```bash
npm run dev
```

3. Open the app.

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

A workout contains exercises. Exercises contain sets. Sets contain one or more metrics.

Example metric combinations:

- reps + weight
- reps only
- time only
- distance + time
- laps + time

## UI Direction

The app is mobile-first because it is primarily used during workouts at the gym. UI patterns should prioritize fast data entry, large tap targets, and low-friction editing.

HyperUI is used as design inspiration through copied Tailwind patterns, not as an installed UI package.

## Project History

This project is a full-stack rebuild based on two older repositories:

- [`fitness-ui`](https://github.com/castab/fitness-ui)
- [`fitness-backend`](https://github.com/castab/fitness-backend)

Those projects used a separate frontend/backend architecture with Next.js, Kotlin Spring Boot, and MongoDB. This app keeps the same core purpose of replacing a paper gym notebook, but merges the concept into one full-stack Next.js application backed by Prisma and PostgreSQL.
