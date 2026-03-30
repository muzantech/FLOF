# FlyHost — Documentation Technique

## Vue d'ensemble

FlyHost est une plateforme d'hébergement cloud full-stack (clone de Vercel) ciblant l'Afrique francophone.  
Monorepo pnpm avec TypeScript. Frontend servi depuis un serveur Pterodactyl (b9ce2f9c) sur flihost.site, API sur Replit.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: v24
- **Package manager**: pnpm
- **TypeScript**: 5.9
- **Framework API**: Express 5
- **Base de données**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Build**: esbuild
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Paiement**: MoneyFusion (Mobile Money Afrique)
- **Email**: Nodemailer (SMTP)
- **Serveurs**: Pterodactyl Panel (Wings API)
- **DNS/CDN**: Cloudflare (wildcard *.flihost.site)

## Architecture de déploiement

```
Internet
  └── Cloudflare (*.flihost.site proxied → 173.212.226.118)
        └── proxy.js sur VPS (port 3000)
              ├── flihost.site           → /public/ (fichiers React buildés)
              ├── /api/payment/mf-relay  → relay MoneyFusion (IP VPS whitelistée)
              ├── /api/*                 → Replit API server (Express)
              └── *.flihost.site         → containers Pterodactyl
```

**CRITIQUE dans proxy.js** :
- `handleRequest` est NOT async — ne jamais utiliser `await` dedans, utiliser `.then()` chains
- Port 3000 = proxy subdomain — NE PAS tuer
- La route mf-relay est async car dans une fonction séparée

## Flux de paiement MoneyFusion

```
User → Frontend → POST /api/payment/initiate ou /subscription (avec phone)
     → API → POST flihost.site/api/payment/mf-relay (relay VPS IP whitelistée)
     → VPS → POST https://www.pay.moneyfusion.net/FLYHOST/8a106a9cd82c8779/pay/
     → MoneyFusion retourne { statut: true, token, url }
     → User redirigé vers url de paiement MoneyFusion
     → Après paiement → return_url: https://flihost.site/callback?id={paymentId}
     → Frontend poll /api/payment/status/{paymentId} (poll aussi MoneyFusion /paiementNotif/{token})
     → Webhook MoneyFusion POST /api/payment/webhook (events: payin.session.completed/cancelled)
```

**Payload correct MoneyFusion** :
```json
{
  "totalPrice": 500,
  "article": [{ "FlyHost Coins": 500 }],
  "numeroSend": "+237XXXXXXXXX",
  "nomclient": "Nom Client",
  "personal_Info": [{ "paymentId": "...", "userId": "..." }],
  "return_url": "https://flihost.site/callback?id=...",
  "webhook_url": "https://flihost.site/api/payment/webhook"
}
```

**URLs MoneyFusion** :
- Paiement : `https://www.pay.moneyfusion.net/FLYHOST/8a106a9cd82c8779/pay/`
- Statut : `https://www.pay.moneyfusion.net/paiementNotif/{token}`
- Relay secret : `flyhost-mf-relay-2026-secret`

## Commandes de déploiement

```bash
# Build frontend
PORT=3001 BASE_PATH="/" pnpm --filter @workspace/flyhost run build

# Deploy vers VPS (Pterodactyl container b9ce2f9c)
node /tmp/deploy-final.mjs
# Utilise header X-Requested-With: XMLHttpRequest — CRITIQUE pour Wings API writes

# Push base de données
pnpm --filter @workspace/db run push-force

# Push GitHub
git push https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/muzantech/FLOF.git main
```

## Structure du projet

```text
/
├── artifacts/
│   ├── api-server/               # Express API (port 8080)
│   │   └── src/
│   │       ├── index.ts          # Entry point + proxy server (port 3000)
│   │       ├── routes/
│   │       │   ├── auth.ts       # Auth JWT
│   │       │   ├── payment.ts    # MoneyFusion payment flow
│   │       │   ├── admin.ts      # Admin panel
│   │       │   ├── notifications.ts
│   │       │   └── ...
│   │       ├── mailer.ts         # Nodemailer SMTP
│   │       └── subdomain-proxy.ts
│   └── flyhost/                  # React + Vite frontend
│       └── src/
│           ├── components/
│           │   ├── fly-layout.tsx          # Layout principal
│           │   ├── payment-phone-modal.tsx # Modal collecte téléphone paiement
│           │   └── campaigns-tab.tsx
│           └── pages/
│               ├── landing.tsx
│               ├── dashboard.tsx
│               ├── subscription.tsx   # Plans + modal paiement
│               ├── payment-callback.tsx
│               └── ...
├── lib/
│   └── db/                       # Drizzle ORM schema + migrations
└── proxy.js                      # VPS proxy (sur serveur Pterodactyl b9ce2f9c)
```

## Schéma de base de données

- `users` — id, name, email, username, passwordHash, avatarUrl, role, coins, referralCode, referredBy, onboardingDone, bio, createdAt
- `teams` — id, name, slug, avatarUrl, ownerId
- `team_members` — teamId, userId, role
- `projects` — id, name, slug, framework, gitRepo, userId, teamId, status
- `deployments` — id, projectId, status, url, commit, branch, isProduction
- `deployment_logs` — deploymentId, level, message, timestamp
- `domains` — projectId, name, verified, primary
- `env_vars` — projectId, key, value, environment
- `subscriptions` — userId, planName, pricePerMonth, bonusCoins, isActive, startedAt, nextBillingAt, cancelledAt
- `coin_transactions` — userId, type (credit/debit), category, amount, description, reference, createdAt
- `referrals` — referrerId, referredId, rewardCoins, createdAt
- `payment_transactions` — userId, paymentId, tokenPay, amount, currency, type, status, metadata
- `promo_codes` — code, discountPercent, bonusCoins, maxUses, usesCount, active, expiresAt
- `notifications` — userId, type, title, message, read, metadata
- `server_subdomains` — subdomain, pterodactylIdentifier, port, ip, userId
- `announcements` — title, content, type, active

## Routes API

### Auth
- `POST /api/auth/register` — Inscription (+10 coins, code referral, → /onboarding)
- `POST /api/auth/login` — Connexion (JWT, daily coins)
- `POST /api/auth/daily-login` — +5 coins/jour
- `GET/PATCH /api/auth/me` — Profil courant

### Paiement (MoneyFusion)
- `GET /api/payment/packages` — Packages coins disponibles
- `POST /api/payment/initiate` — Initier achat coins (body: packageId, phone, promoCode)
- `POST /api/payment/subscription` — Initier abonnement (body: plan, phone)
- `POST /api/payment/webhook` — IPN MoneyFusion (events: payin.session.completed/cancelled)
- `GET /api/payment/status/:paymentId` — Statut transaction (poll MF si pending)
- `POST /api/payment/mf-relay` (sur VPS) — Relay MoneyFusion depuis IP whitelistée

### Projets & Déploiements
- `GET/POST /api/projects` — Liste/création
- `GET/PATCH/DELETE /api/projects/:id` — CRUD
- `GET/POST /api/projects/:id/deployments` — Déploiements
- `GET /api/deployments/:id/logs` — Logs live

### Serveurs Pterodactyl
- `GET /api/servers` — Liste des serveurs
- `POST /api/servers` — Créer serveur
- `POST /api/servers/:uuid/power` — Actions power
- `DELETE /api/servers/:uuid` — Supprimer

### Admin
- `GET /api/admin/stats` — Statistiques globales
- `GET /api/admin/users` — Gestion utilisateurs
- `POST /api/admin/promo-codes` — Créer code promo

### Abonnements
- `GET /api/subscriptions/me` — Abonnement actif
- `POST /api/subscriptions/cancel` — Résilier

### Profil & Coins
- `GET /api/user/profile` — Profil complet
- `PATCH /api/user/profile` — Modifier profil
- `GET /api/user/history` — Historique transactions coins
- `GET /api/user/invoices` — Factures

### Referrals
- `GET /api/referrals/my` — Mon code + liste filleuls
- `POST /api/referrals/apply` — Appliquer un code

## Économie Coins

| Action | Coins |
|--------|-------|
| Inscription | +10 |
| Connexion quotidienne | +5 |
| Referral (parrain) | +50 |
| Referral (filleul) | +25 |
| Achat 100 coins | 500 FCFA |
| Achat 250 coins | 1 100 FCFA |
| Achat 500 coins | 2 000 FCFA |
| Achat 1 000 coins | 3 500 FCFA |
| Achat 2 500 coins | 8 000 FCFA |

## Plans d'abonnement

| Plan | Prix | Durée | Bonus coins |
|------|------|-------|-------------|
| Starter | 500 FCFA | 14 jours | +100 |
| Pro | 1 500 FCFA | 14 jours | +350 |
| Business | 4 000 FCFA | 30 jours | +1 000 |

## Runtimes supportés (Pterodactyl)

| Runtime | Egg | Temps déploiement |
|---------|-----|-------------------|
| Node.js | egg 15 | ~29s |
| TypeScript | egg 15 + tsx | ~30s |
| Python | egg 18 | ~29s |
| HTML/CSS/JS statique | egg 15 + serve | ~36s |
| Java (.java / .jar) | egg 16 | ~25-30s |
| Bun / Deno / Ruby / Go | egg 15 (fallback) | ~29s |

## Design System

- Background : `#09090B`
- Accent : `#FACC15` (jaune)
- Surface : `rgba(28,28,35,0.97)`
- Texte : `#FAFAFA`
- Bordure : `rgba(250,204,21,0.14)`
- Vert succès : `#10b981`
- Rouge erreur : `#ef4444`
- Composants : inline CSS styles (pas Tailwind)

## Infos importantes

- **Admin** : admin@flyhost.site / jarix66 (role=admin, coins illimités)
- **VPS IP** : 173.212.226.118 (whitelistée dans MoneyFusion)
- **Pterodactyl Panel** : https://panel.lionelmelo.qzz.io
- **Proxy serveur** : Pterodactyl container b9ce2f9c
- **MF_RELAY_SECRET** : flyhost-mf-relay-2026-secret
- **Notification helper** : `createNotification(userId, type, title, message, metadata)` dans `notifications.ts`

## Architecture Proxy Subdomain

```
User → https://mon-app.flihost.site
     → Cloudflare (wildcard *.flihost.site → 173.212.226.118)
     → proxy.js port 3000 (handleRequest — NON async!)
     → lookup subdomain dans DB → proxy vers container Pterodactyl
```

Table DB `server_subdomains` : subdomain → port → container IP
Cache in-memory rafraîchi toutes les 30s.

## TypeScript & Composite Projects

Chaque package étend `tsconfig.base.json` (`composite: true`).
Le `tsconfig.json` racine liste tous les packages comme project references.
