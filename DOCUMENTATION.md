# FlyHost — Documentation Complète du Projet

> **Dernière mise à jour :** 29 Mars 2026  
> Ce document permet à n'importe quelle IA (ou développeur) de reprendre le développement là où il a été laissé, sans perdre de contexte.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Infrastructure & services externes](#3-infrastructure--services-externes)
4. [Variables d'environnement (secrets)](#4-variables-denvironnement-secrets)
5. [Structure du monorepo](#5-structure-du-monorepo)
6. [Base de données — Schéma complet](#6-base-de-données--schéma-complet)
7. [API — Toutes les routes](#7-api--toutes-les-routes)
8. [Frontend — Pages et navigation](#8-frontend--pages-et-navigation)
9. [Système de paiement (MoneyFusion)](#9-système-de-paiement-moneyfusion)
10. [Système de coins & plans](#10-système-de-coins--plans)
11. [Serveurs Pterodactyl — Logique complète](#11-serveurs-pterodactyl--logique-complète)
12. [Cron jobs (tâches automatiques)](#12-cron-jobs-tâches-automatiques)
13. [Emails (SMTP)](#13-emails-smtp)
14. [Déploiement du frontend sur flihost.site](#14-déploiement-du-frontend-sur-flihostsite)
15. [Compte admin](#15-compte-admin)
16. [État actuel & fonctionnalités implémentées](#16-état-actuel--fonctionnalités-implémentées)
17. [Fonctionnalités à implémenter (TODO)](#17-fonctionnalités-à-implémenter-todo)
18. [Commandes utiles](#18-commandes-utiles)
19. [Système d'annonces (Announcements)](#19-système-dannonces-announcements)

---

## 1. Vue d'ensemble

**FlyHost** est une plateforme d'hébergement cloud (clone de Vercel) ciblant le marché francophone africain. Les utilisateurs achètent des "coins" avec de l'argent (via MoneyFusion, une solution de paiement mobile en FCFA), puis utilisent ces coins pour créer et gérer des serveurs hébergés sur un VPS dédié via Pterodactyl.

**URL de production :** https://flihost.site  
**Langue principale :** Français  
**Design :** Thème sombre, fond `#09090B`, accent jaune `#FACC15`

---

## 2. Architecture technique

```
┌─────────────────────────────────────────────────────────────┐
│                     UTILISATEUR                              │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  CLOUDFLARE (DNS + Proxy)                    │
│  flihost.site → 173.212.226.118:80                          │
│  *.flihost.site → 173.212.226.118:80 (wildcard proxied)     │
└──────────────────────┬──────────────────────────────────────┘
                       │ Port 80
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                VPS (173.212.226.118)                         │
│                                                             │
│  proxy.js (port 80) → routing:                              │
│  ├── flihost.site → fichiers React statiques               │
│  ├── /api/payment/mf-relay → relay MoneyFusion             │
│  ├── /api/* → API Replit (HTTPS)                            │
│  └── *.flihost.site → conteneurs Pterodactyl               │
│                                                             │
│  Pterodactyl Panel (panel.lionelmelo.qzz.io)                │
│  └── serveurs utilisateurs (containers Docker)             │
└──────────────────────┬──────────────────────────────────────┘
                       │ API calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    REPLIT                                    │
│                                                             │
│  API Server (port 8080) — Node.js/Express/TypeScript        │
│  ├── REST API                                               │
│  ├── WebSocket proxy (console Pterodactyl)                  │
│  ├── Subdomain proxy interne (port 3000)                    │
│  └── Cron jobs (toutes les heures)                          │
│                                                             │
│  PostgreSQL (DATABASE_URL fourni par Replit)                │
└─────────────────────────────────────────────────────────────┘
```

### Flux de requête API

1. L'utilisateur appelle `/api/...` depuis le frontend
2. Cloudflare proxie vers `173.212.226.118:80`
3. `proxy.js` sur le VPS détecte `/api/` et redirige vers l'URL Replit
4. L'API Replit répond → retour vers le client

### Flux de requête sous-domaine (ex: `monapp.flihost.site`)

1. Cloudflare résout `*.flihost.site` → `173.212.226.118:80`
2. `proxy.js` lit le header `Host`, voit `monapp.flihost.site`
3. Cherche dans la DB `server_subdomains` quel port correspond
4. Proxy HTTP vers `127.0.0.1:PORT` (port du container Pterodactyl)

---

## 3. Infrastructure & services externes

### VPS (Hetzner)
- **IP :** `173.212.226.118`
- **Rôle :** Héberger Pterodactyl, servir les fichiers statiques du frontend, proxy
- **Serveur FlyHost (Pterodactyl) :** identifiant `b9ce2f9c` — contient les fichiers React buildés

### Pterodactyl Panel
- **URL :** `https://panel.lionelmelo.qzz.io`
- **Rôle :** Gestionnaire de serveurs de jeux/apps, utilisé pour créer et gérer les serveurs des utilisateurs
- **Eggs (templates) :** Node.js, Python, PHP, Java, Minecraft Vanilla/Paper/Forge, Rust, CS:GO, Garry's Mod, TeamSpeak

### Cloudflare
- **Zone :** `flihost.site`
- **DNS :** Un seul enregistrement wildcard `*.flihost.site → 173.212.226.118` (proxied)
- **Rôle :** CDN, SSL automatique, protection DDoS

### MoneyFusion
- **URL de paiement :** `https://www.pay.moneyfusion.net/FLYHOST/8a106a9cd82c8779/pay/`
- **Secret relay :** `flyhost-mf-relay-2026-secret`
- **Rôle :** Paiement mobile en FCFA (Orange Money, Wave, etc.)
- **Architecture relay :** L'IP du VPS (`173.212.226.118`) est whitelistée chez MoneyFusion. L'API Replit appelle d'abord le relay sur le VPS (`/api/payment/mf-relay`), qui appelle MoneyFusion, et retourne la réponse.

### Replit
- **Projet :** monorepo pnpm
- **API URL dynamique :** Change si le Repl redémarre. Actuellement : `https://e45e8016-d33b-437f-b68f-eaf0f042e9f9-00-1nanj8yfver6c.spock.replit.dev`
- **⚠️ Important :** Si l'URL Replit change, mettre à jour `API_URL` dans `proxy.js` sur le VPS

---

## 4. Variables d'environnement (secrets)

Ces secrets sont configurés dans Replit (Settings > Secrets) :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL (fourni automatiquement par Replit) |
| `SESSION_SECRET` | Clé JWT pour signer les tokens — **ne pas changer** en production |
| `CF_TOKEN` | Token API Cloudflare (pour gérer les DNS wildcard) |
| `CF_ZONE_ID` | ID de la zone Cloudflare pour flihost.site |
| `PTERODACTYL_URL` | URL du panel Pterodactyl (`https://panel.lionelmelo.qzz.io`) |
| `PTERODACTYL_APPLICATION_KEY` | Clé API Application Pterodactyl (pour créer/supprimer des serveurs) |
| `PTERODACTYL_CLIENT_KEY` | Clé API Client Pterodactyl (pour accéder aux fichiers, console) |
| `SERVER_IP` | IP du VPS : `173.212.226.118` |
| `SMTP_HOST` | Serveur SMTP pour l'envoi d'emails |
| `SMTP_PORT` | Port SMTP (587 ou 465) |
| `SMTP_USER` | Identifiant SMTP |
| `SMTP_PASS` | Mot de passe SMTP |
| `SMTP_FROM` | Adresse d'expéditeur (`"FlyHost" <noreply@flihost.site>`) |
| `MF_RELAY_SECRET` | Secret partagé pour sécuriser le relay MoneyFusion (`flyhost-mf-relay-2026-secret`) |

**Variables optionnelles (non encore configurées) :**

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Pour envoyer des notifications Telegram |
| `APP_URL` | URL de l'app (défaut: `https://flihost.site`) |
| `MF_RELAY_URL` | URL du relay MF (défaut: `https://flihost.site/api/payment/mf-relay`) |

---

## 5. Structure du monorepo

```
workspace/
├── pnpm-workspace.yaml          # Définit les workspaces
├── package.json                 # Dépendances racine
├── DOCUMENTATION.md             # Ce fichier
│
├── artifacts/
│   ├── api-server/              # Serveur API Express (Node.js/TypeScript)
│   │   ├── src/
│   │   │   ├── index.ts         # Point d'entrée, HTTP server, WebSocket
│   │   │   ├── app.ts           # App Express (middlewares, routes)
│   │   │   ├── pterodactyl.ts   # Client API Pterodactyl complet
│   │   │   ├── cloudflare.ts    # Gestion DNS Cloudflare
│   │   │   ├── subdomain-proxy.ts # Reverse proxy pour *.flihost.site
│   │   │   ├── cron.ts          # Tâches automatiques (expiration, renouvellement)
│   │   │   ├── mailer.ts        # Envoi d'emails SMTP + templates
│   │   │   ├── middlewares/
│   │   │   │   └── auth.ts      # Middleware JWT requireAuth
│   │   │   └── routes/
│   │   │       ├── index.ts     # Agrège toutes les routes
│   │   │       ├── auth.ts      # /auth/* (login, register, verify, reset)
│   │   │       ├── servers.ts   # /servers/* (CRUD serveurs + free trial)
│   │   │       ├── admin.ts     # /admin/* (gestion utilisateurs)
│   │   │       ├── payment.ts   # /payment/* (MoneyFusion, coins)
│   │   │       ├── deployments.ts # /deployments/*
│   │   │       ├── projects.ts  # /projects/*
│   │   │       ├── domains.ts   # /domains/*
│   │   │       ├── notifications.ts # /notifications/*
│   │   │       ├── referrals.ts # /referral/*
│   │   │       ├── subscriptions.ts # /subscriptions/*
│   │   │       ├── teams.ts     # /teams/*
│   │   │       ├── user-profile.ts # /user/*
│   │   │       ├── stats.ts     # /stats/*
│   │   │       ├── schedules.ts # /schedules/* (restart auto)
│   │   │       ├── marketplace.ts # /marketplace/*
│   │   │       ├── reseller.ts  # /reseller/*
│   │   │       ├── apikeys.ts   # /apikeys/*
│   │   │       ├── proxy.ts     # /proxy/*
│   │   │       ├── deploy.ts    # /deploy/* (déploiement GitHub/zip)
│   │   │       └── health.ts    # GET /health
│   │   ├── build.mjs            # Script de build (esbuild)
│   │   └── package.json
│   │
│   └── flyhost/                 # Frontend React + Vite
│       ├── src/
│       │   ├── App.tsx          # Router principal (wouter)
│       │   ├── hooks/
│       │   │   ├── use-auth.tsx # Contexte d'authentification
│       │   │   └── use-toast.ts
│       │   ├── components/
│       │   │   ├── layout.tsx   # AppLayout (sidebar connectée)
│       │   │   ├── fly-layout.tsx # FlyLayout (layout public)
│       │   │   └── ui/          # Composants shadcn/ui
│       │   └── pages/
│       │       ├── landing.tsx      # Page d'accueil publique
│       │       ├── login.tsx        # Connexion (email ou username)
│       │       ├── register.tsx     # Inscription
│       │       ├── verify-email.tsx # Vérification OTP email
│       │       ├── forgot-password.tsx # Réinitialisation mot de passe
│       │       ├── dashboard.tsx    # Tableau de bord
│       │       ├── servers.tsx      # Liste des serveurs + essai gratuit
│       │       ├── server-detail.tsx # Détail + console WebSocket
│       │       ├── projects.tsx     # Projets GitHub/ZIP
│       │       ├── project-detail.tsx
│       │       ├── deployment-detail.tsx
│       │       ├── deploy.tsx       # Assistant de déploiement
│       │       ├── admin.tsx        # Panel admin (role=admin requis)
│       │       ├── subscription.tsx # Plans & abonnements
│       │       ├── settings.tsx     # Paramètres utilisateur
│       │       ├── profile.tsx      # Profil public
│       │       ├── referral.tsx     # Programme de parrainage
│       │       ├── invoices.tsx     # Historique des paiements
│       │       ├── history.tsx      # Historique des actions
│       │       ├── teams.tsx        # Gestion d'équipes
│       │       ├── docs.tsx         # Documentation publique
│       │       ├── status.tsx       # Statut des services
│       │       ├── onboarding.tsx   # Onboarding premier login
│       │       └── not-found.tsx    # Page 404
│       └── package.json
│
└── lib/
    ├── db/                      # Package partagé Drizzle ORM
    │   ├── src/
    │   │   ├── index.ts         # Export: db, pool + tout le schema
    │   │   └── schema/
    │   │       ├── index.ts     # Re-exporte tous les schemas
    │   │       ├── users.ts     # Table users
    │   │       ├── subdomains.ts # Table server_subdomains
    │   │       ├── deployments.ts
    │   │       ├── domains.ts
    │   │       ├── envvars.ts
    │   │       ├── marketplace.ts
    │   │       ├── metrics.ts
    │   │       ├── notifications.ts
    │   │       ├── payments.ts
    │   │       ├── projects.ts
    │   │       ├── resellers.ts
    │   │       ├── subscriptions.ts
    │   │       └── teams.ts
    │   └── drizzle.config.ts
    └── api-spec/                # OpenAPI spec (optionnel)
```

---

## 6. Base de données — Schéma complet

### `users` (table principale des utilisateurs)

```typescript
{
  id: serial PRIMARY KEY,
  name: text NOT NULL,
  email: text NOT NULL UNIQUE,
  username: text NOT NULL UNIQUE,
  passwordHash: text NOT NULL,           // bcrypt hash
  avatarUrl: text,
  role: text DEFAULT 'user',             // 'user' | 'admin' | 'superadmin'
  coins: integer DEFAULT 10,             // monnaie virtuelle
  referralCode: text UNIQUE,             // code de parrainage
  referredBy: integer,                   // id de l'utilisateur parrain
  onboardingDone: boolean DEFAULT false,
  bio: text,
  streakDays: integer DEFAULT 0,         // jours consécutifs de connexion
  lastDailyClaim: timestamp,             // dernière réclamation daily coins
  emailVerified: boolean DEFAULT false,
  verificationCode: text,                // OTP 6 chiffres
  verificationExpires: timestamp,
  resetCode: text,                       // OTP réinit mot de passe
  resetCodeExpires: timestamp,
  whatsappNumber: text,
  telegramChatId: text,
  discordWebhook: text,
  banned: boolean DEFAULT false,         // compte banni
  freeTrialUsed: boolean DEFAULT false,  // essai gratuit 24H déjà utilisé
  isReseller: boolean DEFAULT false,
  plan: text DEFAULT 'free',             // 'free' | 'starter' | 'pro' | 'business' | 'unlimited'
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `server_subdomains` (serveurs hébergés)

```typescript
{
  id: serial PRIMARY KEY,
  subdomain: text NOT NULL UNIQUE,           // ex: 'monapp' → monapp.flihost.site
  pterodactylIdentifier: text NOT NULL,      // UUID court Pterodactyl (ex: 'a1b2c3d4')
  port: integer NOT NULL,                    // port interne du container
  ip: text DEFAULT '127.0.0.1',             // IP du container
  userId: integer REFERENCES users(id),
  isTrial: boolean DEFAULT false,            // serveur d'essai gratuit
  trialExpiresAt: timestamp,                 // expiration du trial (null si pas trial)
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `deployments` (historique des déploiements)

Chaque déploiement d'un projet (ZIP, GitHub) est enregistré ici avec son statut (`pending`, `running`, `success`, `failed`).

### `projects` (projets utilisateur)

Projets créés depuis le dashboard (liés à des déploiements).

### `payment_transactions` (transactions MoneyFusion)

```typescript
{
  id, userId, paymentId (UUID),
  amount (FCFA), coins, status ('pending'|'completed'|'failed'),
  momoOperator, momoNumber, phoneNumber,
  createdAt, updatedAt
}
```

### `coin_transactions` (historique des coins)

Chaque crédit/débit de coins est journalisé :
```typescript
{ id, userId, type ('credit'|'debit'), category, amount, description, reference }
```

### `subscriptions` (abonnements mensuels serveurs)

```typescript
{ id, userId, pterodactylIdentifier, plan, coinsPerMonth, status, nextRenewalAt }
```

### `notifications` (notifications in-app)

### `promo_codes` (codes promo)

```typescript
{ id, code UNIQUE, discountPercent, bonusCoins, maxUses, usesCount, active, expiresAt }
```

### `restart_schedules` (redémarrages planifiés)

### `server_metrics` (métriques CPU/RAM des serveurs)

### `teams` + `team_members` (équipes)

### `domains` (domaines personnalisés)

### `api_keys` (clés API utilisateur)

### `marketplace_items` + `marketplace_purchases`

---

## 7. API — Toutes les routes

**Base URL en production :** `https://flihost.site/api`  
**Authentification :** Header `Authorization: Bearer <JWT_TOKEN>`

### Auth

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/auth/register` | ❌ | Inscription (name, email, username, password) → token + 10 coins de bienvenue |
| POST | `/auth/login` | ❌ | Connexion par email OU username + password → token |
| GET | `/auth/me` | ✅ | Profil utilisateur connecté |
| POST | `/auth/verify-email` | ✅ | Vérifier OTP email (6 chiffres) |
| POST | `/auth/resend-verification` | ✅ | Renvoyer l'OTP de vérification |
| POST | `/auth/forgot-password` | ❌ | Demande réinitialisation mot de passe |
| POST | `/auth/reset-password` | ❌ | Réinitialiser avec OTP + nouveau mot de passe |
| POST | `/auth/daily-reward` | ✅ | Réclamer les 5 coins quotidiens (streak) |
| POST | `/auth/logout` | ✅ | Déconnexion (côté client — supprime le token) |

### Serveurs (Pterodactyl)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/servers` | ✅ | Liste les serveurs de l'utilisateur |
| GET | `/servers/plans` | ✅ | Liste les types de serveurs avec prix en coins |
| POST | `/servers` | ✅ | Créer un serveur (déduit les coins) |
| DELETE | `/servers/:identifier` | ✅ | Supprimer un serveur |
| POST | `/servers/:identifier/restart` | ✅ | Redémarrer un serveur |
| POST | `/servers/:identifier/stop` | ✅ | Arrêter un serveur |
| POST | `/servers/:identifier/start` | ✅ | Démarrer un serveur |
| GET | `/servers/:identifier/files` | ✅ | Lister les fichiers du serveur |
| GET | `/servers/:identifier/files/contents` | ✅ | Lire un fichier |
| POST | `/servers/:identifier/files/write` | ✅ | Écrire un fichier |
| GET | `/servers/:identifier/backups` | ✅ | Liste des backups |
| POST | `/servers/:identifier/backups` | ✅ | Créer un backup |
| DELETE | `/servers/:identifier/backups/:uuid` | ✅ | Supprimer un backup |
| GET | `/servers/:identifier/subscription` | ✅ | Infos abonnement mensuel |
| POST | `/servers/:identifier/renew` | ✅ | Renouveler manuellement |
| POST | `/servers/free-trial` | ✅ | Créer un serveur d'essai gratuit 24H |
| GET | `/servers/free-trial/status` | ✅ | Statut essai (`freeTrialUsed`, `trialActive`, `trialExpiresAt`) |

### Paiement

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/payment/packages` | ✅ | Packages de coins disponibles |
| POST | `/payment/initiate` | ✅ | Initier un paiement MoneyFusion |
| POST | `/payment/verify` | ✅ | Vérifier statut d'un paiement |
| POST | `/payment/mf-relay` | ❌ | Relay interne MoneyFusion (VPS uniquement, vérifié par secret) |
| POST | `/payment/promo` | ✅ | Appliquer un code promo |

### Admin (role=admin requis)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | `/admin/stats` | ✅ Admin | Stats globales (users, serveurs, revenus) |
| GET | `/admin/users` | ✅ Admin | Liste tous les utilisateurs |
| GET | `/admin/users/:id` | ✅ Admin | Détail utilisateur |
| PATCH | `/admin/users/:id` | ✅ Admin | Modifier user (coins, role, ban) |
| POST | `/admin/users/:id/ban` | ✅ Admin | Bannir un utilisateur |
| POST | `/admin/users/:id/unban` | ✅ Admin | Débannir |
| DELETE | `/admin/users/:id` | ✅ Admin | Supprimer compte |
| GET | `/admin/servers` | ✅ Admin | Tous les serveurs |
| POST | `/admin/promo` | ✅ Admin | Créer un code promo |
| GET | `/admin/transactions` | ✅ Admin | Historique paiements |

### Autres routes

| Module | Routes |
|--------|--------|
| Projets | `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` |
| Déploiements | `GET /deployments`, `POST /deployments`, `GET /deployments/:id` |
| Domaines | `GET/POST /domains`, `DELETE /domains/:id`, `POST /domains/:id/verify` |
| Équipes | `GET/POST /teams`, `POST /teams/:id/invite`, etc. |
| Profil | `GET/PATCH /user/profile`, `POST /user/avatar` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read` |
| Parrainage | `GET /referral/stats`, `POST /referral/claim` |
| Abonnements | `GET /subscriptions` |
| Schedules | `GET/POST /schedules`, `DELETE /schedules/:id` |
| Marketplace | `GET /marketplace`, `POST /marketplace/purchase/:id` |
| Revendeurs | `GET/POST /reseller/*` |
| API Keys | `GET/POST /apikeys`, `DELETE /apikeys/:id` |
| Stats | `GET /stats` |
| Health | `GET /health` |

**WebSocket :** `wss://flihost.site/api/ws/servers/:identifier?token=<JWT>` — console temps réel du serveur

---

## 8. Frontend — Pages et navigation

### Routes publiques (sans connexion)
- `/` — Landing page
- `/login` — Connexion
- `/register` — Inscription
- `/forgot-password` — Réinitialisation mot de passe
- `/status` — Statut des services
- `/docs` — Documentation

### Routes protégées (connexion + email vérifié)
- `/dashboard` — Tableau de bord
- `/servers` — Gestion des serveurs
- `/servers/:identifier` — Détail serveur + console WebSocket
- `/projects` — Projets de déploiement
- `/projects/:id` — Détail projet
- `/deployments/:id` — Détail déploiement
- `/deploy` — Assistant de déploiement
- `/teams` — Gestion d'équipes
- `/settings` — Paramètres compte
- `/profile` — Profil public
- `/subscription` — Plans & abonnements
- `/referral` — Programme parrainage
- `/invoices` — Historique factures
- `/history` — Historique des actions
- `/onboarding` — Onboarding (premier login)
- `/admin` — Panel admin (role admin requis)

### Authentification (hook `use-auth.tsx`)

```typescript
// Token stocké dans localStorage sous la clé :
localStorage.getItem("flyhost_token")

// Le hook expose :
const { user, isLoading, refreshUser, logout } = useAuth();
```

### Clé technique importante

Le frontend est une SPA (Single Page App) servie depuis le serveur Pterodactyl `b9ce2f9c`. Les fichiers buildés sont dans `/var/www/html/` sur ce serveur.

---

## 9. Système de paiement (MoneyFusion)

### Packages de coins disponibles

| Package | Coins | Prix FCFA |
|---------|-------|-----------|
| coins_100 | 100 | 500 FCFA |
| coins_250 | 250 | 1 100 FCFA |
| coins_500 | 500 | 2 000 FCFA |
| coins_1000 | 1 000 | 3 500 FCFA |
| coins_2500 | 2 500 | 8 000 FCFA |

### Flux de paiement

```
1. Frontend → POST /api/payment/initiate { packageId }
2. API → POST /api/payment/mf-relay (via VPS)
3. VPS relay → MoneyFusion API (IP whitelistée)
4. MoneyFusion retourne un lien de paiement
5. Utilisateur paie sur le lien MoneyFusion (mobile money)
6. MoneyFusion webhook → VPS → /api/payment/verify
7. API crédite les coins si paiement confirmé
```

### Relay VPS (proxy.js)

Le fichier `proxy.js` sur le VPS contient une route `/api/payment/mf-relay` :
- Vérifie le header secret `X-Relay-Secret: flyhost-mf-relay-2026-secret`
- Appelle `https://www.pay.moneyfusion.net/FLYHOST/8a106a9cd82c8779/pay/`
- Retourne la réponse

---

## 10. Système de coins & plans

### Gain de coins
- **Inscription :** 10 coins offerts
- **Connexion quotidienne :** 5 coins (streak)
- **Parrainage :** bonus pour le parrain et le filleul
- **Achat :** via MoneyFusion

### Coût des serveurs (coins/mois)

| Type | Coins/mois |
|------|-----------|
| Node.js | 50 |
| Python | 50 |
| PHP | 50 |
| Java | 75 |
| Minecraft Vanilla | 100 |
| Minecraft Paper | 120 |
| Minecraft Forge | 150 |
| CS:GO | 150 |
| Garry's Mod | 100 |
| Rust (jeu) | 200 |
| TeamSpeak | 30 |

### Essai gratuit
- **1 serveur Node.js gratuit pendant 24H** par compte
- Champ `freeTrialUsed` sur `users` pour savoir si déjà utilisé
- Champ `isTrial` + `trialExpiresAt` sur `server_subdomains`
- Cron job qui supprime automatiquement les trials expirés et envoie un email

---

## 11. Serveurs Pterodactyl — Logique complète

### Fichier clé : `artifacts/api-server/src/pterodactyl.ts`

Ce fichier centralise toutes les interactions avec Pterodactyl :
- `createPteroServer(config)` — crée un serveur via l'API Application
- `deletePteroServer(identifier)` — supprime un serveur
- `listPteroServers()` — liste tous les serveurs
- `getPteroServer(identifier)` — détail d'un serveur
- `pteroClientRequest(path)` — requête API Client authentifiée
- `writeFileContents(identifier, path, content)` — écrire un fichier
- `uploadZipToPterodactyl(identifier, buffer)` — uploader un ZIP
- `getUploadUrl(identifier)` — URL signée Wings pour upload

### Eggs configurés (templates Pterodactyl)

Les eggs sont des templates qui définissent l'environnement d'un serveur. Chaque egg a un ID numérique dans Pterodactyl.

Configuration dans `EGG_CONFIGS` dans `routes/servers.ts` :
```typescript
"nodejs" → Egg ID Node.js, variables: NODE_VERSION, START_CMD
"python" → Egg ID Python, variables: PYTHON_VERSION
"php" → Egg PHP
"minecraft" → Egg Minecraft (vanilla, paper, forge)
// etc.
```

### Sous-domaines

Chaque serveur reçoit un sous-domaine automatique `{nom}.flihost.site`. Le sous-domaine est stocké dans `server_subdomains`. Le cron `syncAllSubdomains` rafraîchit le cache au démarrage.

---

## 12. Cron jobs (tâches automatiques)

Fichier : `artifacts/api-server/src/cron.ts`

| Fréquence | Tâche |
|-----------|-------|
| Au démarrage | `fixStuckBuilds()` — corriger les déploiements bloqués |
| Au démarrage | `cleanupTmpDirs()` — nettoyer `/tmp` |
| Au démarrage | `collectMetrics()` — métriques CPU/RAM serveurs |
| Toutes les 5 min | `collectMetrics()` |
| Toutes les heures | `fixStuckBuilds()` |
| Toutes les heures | `cleanupTmpDirs()` |
| Toutes les heures | `processAutoRenewals()` — renouveler abonnements serveurs |
| Toutes les heures | `sendExpirationAlerts()` — alertes expiration (1j, 3j avant) |
| Toutes les heures | `cleanupExpiredTrials()` — supprimer serveurs d'essai expirés |
| Toutes les minutes | `processRestartSchedules()` — redémarrages planifiés |

---

## 13. Emails (SMTP)

Fichier : `artifacts/api-server/src/mailer.ts`

### Fonctions disponibles
- `sendEmail(to, subject, html)` — email HTML générique
- `sendDiscordWebhook(url, content, embeds)` — webhook Discord
- `sendTelegram(chatId, message)` — message Telegram (nécessite `TELEGRAM_BOT_TOKEN`)

### Templates d'email (`emailTemplates`)
- `verificationEmail(name, code)` — vérification email OTP
- `resetPasswordEmail(name, code)` — réinitialisation mot de passe
- `serverExpiring(serverName, daysLeft)` — alerte expiration serveur
- `welcomeBackEmail(name)` — email de bienvenue retour
- `trialExpiredEmail(displayName)` — essai gratuit expiré (inline dans cron)

---

## 14. Déploiement du frontend sur flihost.site

Le frontend React est hébergé sur le serveur Pterodactyl `b9ce2f9c` (pas sur Replit).

### Commande de build

```bash
PORT=3000 BASE_PATH="/" pnpm --filter @workspace/flyhost run build
# Output : artifacts/flyhost/dist/public/
```

### Commande de déploiement (Node.js)

```javascript
const archiver = require('archiver'); // disponible dans node_modules
const fs = require('fs');

const PTERO_URL = process.env.PTERODACTYL_URL;
const API_KEY = process.env.PTERODACTYL_CLIENT_KEY;
const SERVER_ID = 'b9ce2f9c';

// 1. Zipper artifacts/flyhost/dist/public/
// 2. Upload via POST {PTERO_URL}/api/client/servers/{SERVER_ID}/files/write?file=/flyhost-frontend.zip
//    Headers: Authorization: Bearer {API_KEY}, Content-Type: application/octet-stream
// 3. Décompresser via POST {PTERO_URL}/api/client/servers/{SERVER_ID}/files/decompress
//    Body: { root: "/", file: "flyhost-frontend.zip" }
```

**Voir le script complet dans les logs de session** ou reproduire à partir de `pterodactyl.ts` (fonction `uploadZipToPterodactyl`).

---

## 15. Compte admin

| Champ | Valeur |
|-------|--------|
| Email | `admin@flyhost.site` |
| Username | `admin` |
| Mot de passe | `jarix66` |
| Rôle | `admin` |
| Coins | illimités (ne sont pas déduits pour les admins) |

Le panel admin est accessible sur `/admin` (nécessite d'être connecté avec role=admin).

**Fonctionnalités admin :**
- Voir stats globales
- Lister, bannir, débannir, supprimer des utilisateurs
- Modifier coins et rôle d'un utilisateur
- Créer des codes promo
- Voir tous les serveurs

---

## 16. État actuel & fonctionnalités implémentées

### ✅ Terminé et déployé

- **Authentification complète** : inscription, connexion (email ou username), vérification email OTP, réinitialisation mot de passe
- **Système de coins** : gain à l'inscription (+10), daily login (+5 avec streak), achat via MoneyFusion
- **Gestion de serveurs** : créer/supprimer/redémarrer, console WebSocket temps réel, gestionnaire de fichiers
- **Essai gratuit 24H** : 1 serveur Node.js gratuit par compte, suppression auto par cron, email de notification
- **Sous-domaines automatiques** : `{nom}.flihost.site` via proxy Cloudflare + reverse proxy
- **Paiement MoneyFusion** : packages coins, relay VPS, confirmation via webhook, codes promo
- **Panel admin** : gestion utilisateurs (liste, ban, unban, suppr, coins, rôle) + gestion des annonces
- **Migration utilisateurs** : 73 utilisateurs importés depuis l'ancienne DB SQLite, emails de bienvenue envoyés
- **Abonnements mensuels** : renouvellement automatique par cron, alertes expiration
- **Notifications in-app** : système de notifications
- **Parrainage** : codes de parrainage, bonus pour parrain et filleul — champ toujours visible sur la page d'inscription
- **Equipes** : création et gestion d'équipes
- **Schedules** : redémarrage automatique de serveurs selon horaire
- **Déploiements GitHub/ZIP** : upload et déploiement de projets sur les serveurs
- **Domaines personnalisés** : ajout et vérification de domaines
- **Landing page complète** : page d'accueil en français avec guide 3 étapes, features, CTA essai gratuit
- **Page `/pricing`** : tarifs complets en FCFA/coins, FAQ
- **Page 404 personnalisée** : thème sombre, liens utiles en français
- **SEO & Open Graph** : meta tags complets, OG image, Twitter Card, `lang="fr"` dans `index.html`
- **Widget support WhatsApp** : bouton flottant en bas à droite dans toutes les pages authentifiées
- **Alerte coins bas** : bannière jaune dans la navbar quand `coins < 50`, avec bouton "Recharger"
- **Streak visible** : badge flamme 🔥 dans le header du dashboard (si streak ≥ 2 jours)
- **Système d'annonces** : backend CRUD + frontend sur le dashboard (dismissable, types info/warning/success/error)
- **Email de bienvenue enrichi** : template HTML complet envoyé après vérification email (avec coins bonus, liens utiles)

### ⚠️ Partiellement implémenté

- **Page docs** : existe mais contenu générique (pas de vraie documentation produit)
- **Page status** : existe mais données statiques
- **Marketplace** : backend existe, UI basique
- **Admin panel annonces** : l'API est prête (`POST /api/admin/announcements`), l'UI admin n'a pas encore de section dédiée (peut utiliser l'API directement)

---

## 17. Fonctionnalités à implémenter (TODO)

Voici ce qui reste à faire :

### Priorité haute

1. **UI admin pour les annonces** — ajouter un onglet "Annonces" dans `/admin` pour créer/supprimer/activer les annonces
2. **Numéro WhatsApp configurable** — actuellement hardcodé comme `+22300000000`, à changer pour le vrai numéro dans `layout.tsx`

### Priorité moyenne

3. **Vraie documentation produit** (page `/docs`) — guide d'utilisation, exemples de commandes
4. **Page status dynamique** — uptime réel basé sur les métriques en DB
5. **Notifications push / email digest** — résumé hebdomadaire par email

### Priorité basse

6. **Mode revendeur** — le backend existe mais l'UI n'est pas complète
7. **Marketplace de plugins** — système de templates/apps pré-configurées
8. **Support 2FA** — authentification à deux facteurs

---

## 18. Commandes utiles

### Développement

```bash
# Démarrer l'API en dev
pnpm --filter @workspace/api-server run dev

# Démarrer le frontend en dev
pnpm --filter @workspace/flyhost run dev

# Installer les dépendances
pnpm install

# Pousser les changements de schéma DB
pnpm --filter @workspace/db run db:push
# ou si des conflits :
pnpm --filter @workspace/db run db:push --force
```

### Déploiement frontend

```bash
# 1. Build
PORT=3000 BASE_PATH="/" pnpm --filter @workspace/flyhost run build

# 2. Deploy sur le VPS (depuis Replit)
node deploy-frontend.js  # voir section 14 pour le script
```

### Base de données

```bash
# Drizzle Studio (interface visuelle)
pnpm --filter @workspace/db run db:studio

# Générer les migrations
pnpm --filter @workspace/db run db:generate
```

### Tests rapides API

```bash
# Health check
curl https://flihost.site/api/health

# Login
curl -X POST https://flihost.site/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flyhost.site","password":"jarix66"}'
```

---

## Notes techniques importantes

1. **JWT Secret** : défini dans `SESSION_SECRET`. Si changé, tous les tokens existants seront invalidés et tous les utilisateurs devront se reconnecter.

2. **URL Replit** : L'URL du Repl change si le projet est redémarré "froid". Dans ce cas, mettre à jour `API_URL` dans `proxy.js` sur le VPS. C'est le principal point fragile de l'architecture.

3. **Port 3000 sur Replit** : Ne pas interférer — c'est le proxy de sous-domaines qui gère `*.flihost.site`.

4. **Port 8080 sur Replit** : Port de l'API REST.

5. **Drizzle ORM** : Toujours utiliser `db:push` pour synchroniser le schéma, jamais écrire du SQL manuel. Ne jamais changer le type d'une colonne `id` (serial ↔ uuid) sans migration sécurisée.

6. **`archiver` npm** : Disponible dans les dépendances pour créer des ZIP. Utiliser le chemin `node_modules/.pnpm/archiver@7.0.1/node_modules/archiver`.

---

---

## 19. Système d'annonces (Announcements)

### Architecture

La table `announcements` permet à l'admin de publier des messages visibles sur le dashboard des utilisateurs.

**Schéma DB** : `lib/db/src/schema/announcements.ts`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | serial | Clé primaire |
| `title` | text | Titre de l'annonce |
| `message` | text | Corps du message |
| `type` | text | `info` / `warning` / `success` / `error` |
| `active` | boolean | Visible si `true` |
| `createdAt` | timestamp | Date de création |
| `expiresAt` | timestamp | Expiration auto (optionnel) |

### API Routes

| Méthode | Route | Accès | Description |
|---------|-------|-------|-------------|
| `GET` | `/api/announcements` | Public | Annonces actives et non-expirées |
| `POST` | `/api/admin/announcements` | Admin | Créer une annonce |
| `PATCH` | `/api/admin/announcements/:id` | Admin | Modifier/activer/désactiver |
| `DELETE` | `/api/admin/announcements/:id` | Admin | Supprimer |

### Exemple: créer une annonce via API

```bash
curl -X POST https://flihost.site/api/admin/announcements \
  -H "Authorization: Bearer <token_admin>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Maintenance programmée",
    "message": "Le système sera en maintenance le 1er avril de 2h à 4h.",
    "type": "warning",
    "expiresAt": "2026-04-01T04:00:00Z"
  }'
```

### Frontend

- **Hook** : `artifacts/flyhost/src/hooks/use-announcements.ts` — récupère toutes les annonces actives via React Query, rafraîchi toutes les 10 minutes
- **Dashboard** : affichage en haut de page avec couleur selon type, bouton "X" pour dismisser (côté client uniquement)
- **TODO** : ajouter un onglet "Annonces" dans le panel `/admin` pour gérer via l'UI

---

## Modifications récentes (29 mars 2026)

1. **Page 404** — refonte complète en français avec thème sombre, liens rapides (Dashboard, Serveurs, Documentation)
2. **SEO & Open Graph** — `index.html` mis à jour : `lang="fr"`, meta description, OG tags, Twitter Card, theme-color
3. **Widget WhatsApp** — bouton flottant vert en bas à droite dans `AppLayout` (lien vers `wa.me/22300000000`)  
   ⚠️ **Changer le numéro** dans `artifacts/flyhost/src/components/layout.tsx` ligne ~330
4. **Inscription** — champ code de parrainage maintenant toujours visible (optionnel, avec badge "+20 coins bonus")
5. **Alerte coins bas** — bannière sous la navbar si `coins < 50` avec CTA "Recharger"
6. **Dashboard** — badge streak 🔥 si ≥ 2 jours, bouton "Serveurs" ajouté dans le header, fil d'annonces avec dismiss
7. **Email bienvenue** — template HTML complet envoyé après vérification email (`emailTemplates.welcomeEmail`)
8. **Annonces** — nouvelle table DB `announcements`, routes CRUD admin, hook frontend `useAnnouncements`

---

*Document généré automatiquement à partir du code source. Pour toute reprise du développement, lire ce fichier en premier, puis explorer les fichiers listés en section 5.*
