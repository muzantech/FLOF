# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: JWT (jsonwebtoken + bcryptjs)

## Project: FlyHost (Vercel Clone)

FlyHost is a full-stack hosting platform (Vercel clone) with:
- User authentication (JWT, bcrypt)
- Project management
- Simulated deployments (with live build logs)
- Custom domain management
- Environment variables per project
- Team management with member invites
- Dashboard with statistics
- **Coins economy** (10 on signup, daily login, referrals, subscription bonuses)
- **Subscription plans** (Starter/Pro/Business — paid in coins)
- **Referral program** (+50 coins per referral, +25 for referred user)
- **Admin/Reseller panel** with pack purchasing, Pterodactyl server admin view
- **Pterodactyl Panel integration** (real servers: create, list, power actions, suspend/delete)
- **Status page** with service uptime/incidents
- **Documentation** with sidebar navigation
- **Onboarding wizard** (3-step)
- **Profile page** with stats, security, API key, referral
- **Invoices & History** transaction tracking

## Frontend Pages

All pages use unified `AppLayout` (dark theme: #09090B, yellow accent: #FACC15, hamburger drawer nav).
`FlyLayout` is now a bridge component that delegates to `AppLayout` for consistency.

- `/` — Landing
- `/login` `/register` — Auth
- `/onboarding` — 3-step wizard
- `/dashboard` — Project stats
- `/projects` `/projects/:id` — Project management
- `/deploy` — New deployment wizard (GitHub/ZIP/Template, env vars, live logs)
- `/teams` — Team management
- `/settings` — User settings
- `/profile` — Profile editor, security, API key, referral, stats
- `/subscription` — Plan cards, comparison table, FAQ
- `/referral` — Share code, apply code, list filleuls
- `/invoices` — Transaction receipts
- `/history` — Timeline of all coin movements
- `/servers` — Pterodactyl server management (list, create, power actions, delete)
- `/admin` — Admin panel (Pterodactyl server management + reseller dashboard + stats)
- `/status` — Service uptime monitoring (public)
- `/docs` — Documentation with sidebar (public)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── flyhost/            # React + Vite frontend
│       └── src/
│           ├── components/
│           │   ├── fly-layout.tsx      # Shared FlyHost layout (topbar + drawer)
│           │   └── layout.tsx          # Original AppLayout
│           └── pages/                  # All pages
├── lib/
│   ├── api-spec/           # OpenAPI spec
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas
│   └── db/                 # Drizzle ORM schema
```

## Database Schema

- `users` — id, name, email, username, passwordHash, avatarUrl, **role**, **coins**, **referralCode**, **referredBy**, **onboardingDone**, **bio**, createdAt
- `teams` — id, name, slug, avatarUrl, ownerId
- `team_members` — teamId, userId, role
- `projects` — id, name, slug, framework, gitRepo, userId, teamId, status
- `deployments` — id, projectId, status, url, commit, branch, isProduction
- `deployment_logs` — deploymentId, level, message, timestamp
- `domains` — projectId, name, verified, primary
- `env_vars` — projectId, key, value, environment
- **`subscriptions`** — userId, planName, pricePerMonth, bonusCoins, isActive, startedAt, nextBillingAt, cancelledAt
- **`coin_transactions`** — userId, type (credit/debit), category, amount, description, reference, createdAt
- **`referrals`** — referrerId, referredId, rewardCoins, createdAt

## API Routes

### Auth
- `POST /api/auth/register` — Register (gives +10 coins, generates referral code, redirects to /onboarding)
- `POST /api/auth/login` — Login (returns coins, role, referralCode, onboardingDone)
- `POST /api/auth/daily-login` — Claim daily login +5 coins (once per day, triggered automatically on login)
- `GET/PATCH /api/auth/me` — Current user (returns full profile including coins, role, etc.)
- `POST /api/complete-onboarding` — Mark onboarding done

### Projects & Deployments
- `GET/POST /api/projects` — List/create
- `GET/PATCH/DELETE /api/projects/:id` — CRUD
- `GET/POST /api/projects/:id/deployments` — Deployments
- `GET /api/deployments/:id` `/logs` `/cancel` `/promote`

### Domains & Env
- `GET/POST /api/projects/:id/domains`
- `GET/POST /api/projects/:id/env`

### Teams
- `GET/POST /api/teams` + `/members`

### Stats
- `GET /api/stats`

### User Profile (new)
- `GET /api/user/profile` — Full profile + sub + referral count
- `PATCH /api/user/profile` — Update name/bio/avatarUrl
- `GET /api/user/coins` — Coin balance
- `GET /api/user/history` — All coin transactions
- `GET /api/user/invoices` — Invoice list

### Subscriptions (new)
- `GET /api/subscriptions/me` — Active subscription
- `POST /api/subscriptions/subscribe` — Subscribe to plan (deducts coins + gives bonus)
- `POST /api/subscriptions/cancel` — Cancel subscription

### Referrals (new)
- `GET /api/referrals/my` — My code + list of referrals
- `POST /api/referrals/apply` — Apply a referral code

## Coins Economy

- **Plans**: Starter (500 coins/mo, +100 bonus), Pro (1500/mo, +350 bonus), Business (4000/mo, +1000 bonus)
- **Referral**: +50 to referrer, +25 to referred
- **Signup**: +10 coins

## Design System

- Background: `#09090B`
- Accent: `#FACC15` (yellow)
- Surface: `rgba(28,28,35,0.97)`
- Text: `#FAFAFA`
- Border: `rgba(250,204,21,0.14)`
- Font: Plus Jakarta Sans / Inter
- Animated orb backgrounds (yellow + orange blur)
- FlyLayout component uses inline CSS styles (not Tailwind)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.
