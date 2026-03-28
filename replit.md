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
- Simulated deployments (with build logs)
- Custom domain management
- Environment variables per project
- Team management with member invites
- Dashboard with statistics

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (auth, projects, deployments, domains, teams, stats)
│   └── flyhost/            # React + Vite frontend (Vercel clone UI)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- `users` - User accounts (id, name, email, username, passwordHash, avatarUrl)
- `teams` - Teams (id, name, slug, avatarUrl, ownerId)
- `team_members` - Team membership (teamId, userId, role)
- `projects` - Projects (id, name, slug, framework, gitRepo, userId, teamId, status, latestDeployment*)
- `deployments` - Deployments (id, projectId, status, url, commit, branch, isProduction)
- `deployment_logs` - Build logs (deploymentId, level, message, timestamp)
- `domains` - Custom domains (projectId, name, verified, primary)
- `env_vars` - Environment variables (projectId, key, value, environment)

## API Routes

- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET/PATCH /api/auth/me` - Current user
- `GET/POST /api/projects` - List/create projects
- `GET/PATCH/DELETE /api/projects/:id` - Project CRUD
- `GET/POST /api/projects/:id/deployments` - Deployments
- `GET/POST /api/deployments/:id` - Deployment details
- `POST /api/deployments/:id/cancel` - Cancel
- `POST /api/deployments/:id/promote` - Promote to production
- `GET /api/deployments/:id/logs` - Build logs
- `GET/POST /api/projects/:id/domains` - Domains
- `DELETE/POST /api/domains/:id` - Remove/verify domain
- `GET/POST /api/projects/:id/env` - Env vars
- `DELETE /api/projects/:id/env/:id` - Delete env var
- `GET/POST /api/teams` - Teams
- `GET/POST /api/teams/:id/members` - Team members
- `GET /api/stats` - Dashboard stats

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
