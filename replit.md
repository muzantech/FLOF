# FlyHost — Documentation Technique

## Vue d'ensemble

FlyHost est une plateforme d'hébergement cloud full-stack (clone de Vercel) ciblant l'Afrique francophone.  
Monorepo pnpm avec TypeScript. Frontend + API déployés sur le VPS via containers Pterodactyl. Replit est uniquement utilisé pour le développement — la production est 100% indépendante de Replit.

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
- **IA**: GiftedTech API (`gpt4o` → `gemini` → `ai` fallback chain)

## Architecture de déploiement

```
Internet
  └── Cloudflare (*.flihost.site proxied → 173.212.226.118)
        └── proxy.js sur VPS — container b9ce2f9c (port 3000)
              ├── flihost.site           → /public/ (fichiers React buildés)
              ├── /api/payment/mf-relay  → relay MoneyFusion (IP VPS whitelistée)
              ├── /api/*                 → container flyhost-api dfc2746a (port 3009)
              └── *.flihost.site         → containers Pterodactyl utilisateurs
```

**Containers Pterodactyl sur le VPS (173.212.226.118)** :

| Container | Identifier | Port | Rôle |
|-----------|-----------|------|------|
| flyhost (proxy) | b9ce2f9c | 3000 | proxy.js — routing principal |
| flyhost-api | dfc2746a | 3009 | API Express (production) |
| flyhost-postgres | 10638e67 | 3010 | PostgreSQL 18.3 (production DB) |

**Base de données de production** :
- PostgreSQL 18.3 hébergé dans le container `flyhost-postgres` (10638e67)
- `DATABASE_URL=postgresql://flyhost:flyhost_prod_2026@173.212.226.118:3010/flyhost`
- Le deploy script utilise `PROD_DATABASE_URL` (secret Replit) ou construit l'URL depuis `SERVER_IP`
- Le cluster PostgreSQL utilise `LD_PRELOAD=/home/container/uid-fix.so` pour contourner l'absence de UID 999 dans `/etc/passwd`
- Heartbeat toutes les 30s avec redémarrage automatique si PG ne répond plus
- **NE PAS modifier le container 10638e67 sans backup** — toutes les données prod sont là

## FlyBot — Assistant IA

**Architecture hybride** (résiliente aux pannes VPS) :
1. Le frontend tente d'abord `POST /api/ai/chat` (backend sécurisé, timeout 5s)
2. Si le backend renvoie 404/timeout → fallback direct vers GiftedTech API depuis le browser

**Fichiers** :
- `artifacts/flyhost/src/components/ai-chat.tsx` — widget chat flottant, tout le layout
- `artifacts/flyhost/src/pages/server-detail.tsx` → bouton "Analyser avec l'IA" (console logs)
- `artifacts/api-server/src/routes/ai.ts` — 3 routes : `/api/ai/chat`, `/api/ai/analyze-logs`, `/api/ai/deploy-help`
- `artifacts/api-server/vps-proxy/proxy.js` — routing des `/api/ai/*` vers le container API

**GiftedTech API** :
- Endpoint : `GET https://api.giftedtech.co.ke/api/ai/{model}?apikey={KEY}&q={question}`
- Clé : `gifted-api_0u5a705yfobo870e70ge6` (aussi dans `GIFTED_API_KEY` secret Replit)
- Réponse : `{ status: 200, result: "..." }`
- Chain : `gpt4o` → `gemini` → `ai`
- Contexte FLYHOST_CONTEXT injecté dans chaque prompt pour que l'IA connaisse FlyHost

**CRITIQUE dans proxy.js** :
- `handleRequest` est NOT async — ne jamais utiliser `await` dedans, utiliser `.then()` chains
- Port 3000 = proxy subdomain — NE PAS tuer
- La route mf-relay est async car dans une fonction séparée
- `API_URL` parsé via `new URL()` pour extraire host et port correctement

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

### Déployer l'API en production (VPS)
```bash
# Une seule commande — build + zip + upload + restart + vérification (~45s)
pnpm --filter @workspace/api-server run deploy

# Script : artifacts/api-server/deploy-vps.mjs
# Container cible : dfc2746a (flyhost-api, port 3009)
```

### Déployer le frontend en production (VPS)
```bash
# Une seule commande — build + upload fichier par fichier dans /public/
pnpm --filter @workspace/api-server run deploy:frontend

# Script : artifacts/api-server/deploy-frontend.mjs
# Container cible : b9ce2f9c (proxy+frontend, port 3000)
# Méthode : upload direct via Wings upload URL (&directory=/public)
#   → FIABLE : bypass le Wings daemon instable (pas de décompression ZIP)
#   → Upload chaque fichier buildé + sitemap.xml + robots.txt individuellement
# ⚠️ NE PAS utiliser Wings file/write ou files/decompress — le Wings daemon
#    de ce container est instable et écrit du JSON brut au lieu du contenu
```

### Autres commandes utiles
```bash
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
│   │       │   ├── auth.ts       # Auth JWT + email vérification
│   │       │   ├── payment.ts    # MoneyFusion payment flow
│   │       │   ├── admin.ts      # Admin panel + stats
│   │       │   ├── deploy.ts     # Déploiements + emails post-deploy
│   │       │   ├── notifications.ts
│   │       │   └── ...
│   │       ├── mailer.ts         # Nodemailer SMTP + templates (welcome, verify, deploymentSuccess, deploymentFailed)
│   │       ├── backup.ts         # Backup cron (2h00 quotidien, 7 jours rotation)
│   │       ├── health.ts         # Health endpoint enrichi (DB latence, RAM, uptime)
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
- `revoked_tokens` — token (PK), revokedAt — révocation JWT à la déconnexion

## Sécurité & Fiabilité

### Authentification renforcée
- **JWT 7 jours** avec révocation via table `revoked_tokens` (token blacklisté à la déconnexion)
- **Email vérifié obligatoire** avant connexion — le login retourne une erreur explicite sinon
- **Mot de passe minimum 8 caractères** — validé côté API
- **Messages d'erreur unifiés** en français, sans fuite d'information (anti-enumeration)
- **Renvoi email vérification** : `POST /api/auth/resend-verification-public` (public, sans auth, réponse identique si email inexistant)

### Monitoring & Backup
- **Health endpoint enrichi** : `GET /api/healthz` retourne statut, DB latence (ms), uptime (s), RAM utilisée (%)
- **Backup automatique** : cron node-cron chaque nuit à 2h00 → JSON dump de 14 tables → rotation 7 jours dans `./backups/`

### Emails transactionnels
- **Déploiement réussi** : email envoyé automatiquement avec lien vers le projet
- **Déploiement échoué** : email envoyé avec message d'erreur (non-bloquant via `.catch()`)

## Routes API

### Auth
- `POST /api/auth/register` — Inscription (+10 coins, code referral, → /onboarding)
- `POST /api/auth/login` — Connexion (JWT 7j, daily coins, bloqué si email non vérifié)
- `POST /api/auth/resend-verification-public` — Renvoyer email vérification (public, sans auth)
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
- `GET /api/admin/stats` — Stats plateforme : totalUsers, newUsersToday, deploymentsToday, revenueMonth (FCFA)
- `GET /api/admin/users` — Gestion utilisateurs
- `PATCH /api/admin/users/:id/coins` — Modifier coins d'un utilisateur
- `POST /api/admin/promo-codes` — Créer code promo

### Monitoring
- `GET /api/healthz` — Statut API (status, db.latencyMs, uptime, memory.usedPct, timestamp)

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
- **Container proxy** : b9ce2f9c (port 3000) — proxy.js, frontend statique
- **Container API prod** : dfc2746a (port 3009) — flyhost-api, API Express
- **MF_RELAY_SECRET** : flyhost-mf-relay-2026-secret
- **Notification helper** : `createNotification(userId, type, title, message, metadata)` dans `notifications.ts`
- **Replit utilisé pour** : développement uniquement — prod 100% sur VPS

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
