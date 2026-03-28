/**
 * FLYHOST — Utilitaires partagés
 * ─────────────────────────────────────────────────────────
 * Remplace les 22 doublons de toast(), 17 de logout(),
 * 17 de sidebar, auth check, etc. dispersés dans 32 pages.
 *
 * Inclure AVANT les scripts page-spécifiques :
 *   <script src="/utils.js"></script>
 */
(function (w) {
    'use strict';

    // ─── Toast (meilleure implémentation, remplace toutes les variantes) ────
    function _ensureToastContainer() {
        if (document.getElementById('fh-tc')) return document.getElementById('fh-tc');
        const c = document.createElement('div');
        c.id = 'fh-tc';
        c.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column-reverse;gap:8px;pointer-events:none;max-width:360px;width:calc(100% - 48px)';
        document.body.appendChild(c);
        return c;
    }

    const TOAST_ICONS = { success:'fa-circle-check', error:'fa-circle-xmark', warning:'fa-triangle-exclamation', info:'fa-circle-info', coins:'fa-coins' };
    const TOAST_COLORS = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#FACC15', coins:'#FACC15' };

    function toast(message, type = 'info', duration = 4000) {
        // If notifications.js is loaded, delegate to it (avoids duplicate toasts)
        if (w.FHNotif && w.FHNotif.show && type !== '_raw') {
            const t = typeof message === 'string' ? { title: message } : message;
            w.FHNotif.show(t, type, duration);
            return;
        }
        const container = _ensureToastContainer();
        const color = TOAST_COLORS[type] || TOAST_COLORS.info;
        const icon  = TOAST_ICONS[type]  || TOAST_ICONS.info;
        const text  = typeof message === 'string' ? message : (message.title || '');
        const body  = typeof message === 'object' ? message.body : null;

        const el = document.createElement('div');
        el.style.cssText = [
            'background:rgba(14,14,19,0.97)',
            'border:1px solid rgba(250,204,21,0.18)',
            `border-left:3px solid ${color}`,
            'border-radius:12px','padding:13px 16px',
            'display:flex','align-items:flex-start','gap:12px',
            'font-family:"Plus Jakarta Sans",sans-serif',
            'font-size:13px','color:#FAFAFA',
            'pointer-events:auto','cursor:default',
            'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
            'transform:translateX(120%)',
            'transition:transform 0.3s cubic-bezier(0.4,0,0.2,1)',
            'max-width:100%'
        ].join(';');
        el.innerHTML = `<i class="fas ${icon}" style="color:${color};margin-top:2px;flex-shrink:0"></i>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700">${_esc(text)}</div>
                ${body ? `<div style="color:#A1A1AA;font-size:12px;margin-top:2px;line-height:1.4">${_esc(body)}</div>` : ''}
            </div>
            <button style="background:none;border:none;color:#52525B;cursor:pointer;font-size:16px;padding:0;flex-shrink:0;line-height:1" onclick="this.closest('div[style]').remove()">&times;</button>`;

        container.appendChild(el);
        requestAnimationFrame(() => { el.style.transform = 'translateX(0)'; });
        const tid = setTimeout(() => { el.style.transform = 'translateX(120%)'; setTimeout(() => el.remove(), 350); }, duration);
        el.querySelector('button').addEventListener('click', () => clearTimeout(tid));
    }

    // Aliases attendus dans les pages
    function showSuccess(msg) { toast(msg, 'success'); }
    function showError(msg)   { toast(msg, 'error', 5000); }
    function showInfo(msg)    { toast(msg, 'info', 3000); }
    function showWarn(msg)    { toast(msg, 'warning'); }

    // ─── Auth ────────────────────────────────────────────────────────────────
    function getToken()  { return localStorage.getItem('flyhost_token') || ''; }
    function getUser()   { try { return JSON.parse(localStorage.getItem('flyhost_user') || '{}'); } catch { return {}; } }
    function isLoggedIn(){ return !!getToken(); }

    function requireAuth(redirectTo) {
        if (!getToken()) { window.location.href = redirectTo || '/login'; return false; }
        return true;
    }

    // ─── JWT auto-refresh ─────────────────────────────────────────────────────
    function getTokenExpiry() {
        const token = getToken();
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp ? payload.exp * 1000 : null;
        } catch { return null; }
    }

    async function refreshAuthToken() {
        const refreshToken = localStorage.getItem('flyhost_refresh_token');
        if (!refreshToken) return false;
        try {
            const r = await fetch('/api/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            const d = await r.json();
            if (d.success && d.token) {
                localStorage.setItem('flyhost_token', d.token);
                return true;
            }
        } catch (_) {}
        return false;
    }

    async function autoRefreshIfNeeded() {
        const expiry = getTokenExpiry();
        if (!expiry) return;
        const msLeft = expiry - Date.now();
        // Refresh if token expires in less than 24h
        if (msLeft > 0 && msLeft < 24 * 60 * 60 * 1000) {
            await refreshAuthToken();
        } else if (msLeft <= 0) {
            // Token expired — try refresh, otherwise logout
            const ok = await refreshAuthToken();
            if (!ok && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
                logout();
            }
        }
    }

    // ─── Logout (remplace les 17 variantes) ─────────────────────────────────
    function logout() {
        localStorage.removeItem('flyhost_token');
        localStorage.removeItem('flyhost_user');
        localStorage.removeItem('flyhost_refresh_token');
        localStorage.removeItem('flyhost_onboarding_done');
        localStorage.removeItem('fh_onboarding_done');
        window.location.href = '/login';
    }

    // ─── Drawer (remplace les 17 variantes) ─────────────────────────────────
    function toggleSidebar() {
        const d = document.getElementById('drawer');
        if (!d) return;
        d.classList.contains('open') ? closeSidebar() : openSidebar();
    }
    function openSidebar() {
        const d = document.getElementById('drawer');
        const o = document.getElementById('drawerOverlay');
        const h = document.getElementById('hamburgerBtn');
        if (d) d.classList.add('open');
        if (o) { o.classList.add('active'); o.style.display = 'block'; }
        if (h) h.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        const d = document.getElementById('drawer');
        const o = document.getElementById('drawerOverlay');
        const h = document.getElementById('hamburgerBtn');
        if (d) d.classList.remove('open');
        if (o) { o.classList.remove('active'); o.style.display = 'none'; }
        if (h) h.classList.remove('open');
        document.body.style.overflow = '';
    }

    // ─── Charger infos user dans le drawer ─────────────────────────────────
    function fillDrawer() {
        const user = getUser();
        if (!user || !user.username) return;
        const initial = (user.username || '?')[0].toUpperCase();
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('drawerUsername', user.username);
        set('drawerCoins', (user.coins || 0).toLocaleString('fr-FR'));
        set('drawerAvatar', initial);
        set('topbarAvatar', initial);
        const roleBadge = document.getElementById('drawerRole');
        if (roleBadge) {
            const roles = { superadmin:'Super Admin', admin:'Admin', reseller:'Revendeur', user:'Utilisateur' };
            roleBadge.textContent = roles[user.role] || 'Utilisateur';
            roleBadge.className = 'drawer-role-badge ' + (user.role === 'superadmin' ? 'superadmin' : user.role === 'admin' ? 'admin' : '');
        }
        // Show/hide admin sections
        const adminSec = document.getElementById('adminSectionTitle');
        const adminLink = document.getElementById('adminDashboardLink');
        const resSec = document.getElementById('resellerSectionTitle');
        const resLink = document.getElementById('resellerDashboardLink');
        const isAdmin = ['admin','superadmin'].includes(user.role);
        const isRes   = ['reseller','admin','superadmin'].includes(user.role);
        if (adminSec)  adminSec.style.display  = isAdmin ? '' : 'none';
        if (adminLink) adminLink.style.display = isAdmin ? '' : 'none';
        if (resSec)    resSec.style.display    = isRes   ? '' : 'none';
        if (resLink)   resLink.style.display   = isRes   ? '' : 'none';
    }

    // ─── Escape helper ────────────────────────────────────────────────────────
    function _esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ─── Expiration alerts ────────────────────────────────────────────────────
    async function checkExpirationAlerts() {
        const token = getToken();
        if (!token) return;
        const already = JSON.parse(sessionStorage.getItem('fh_exp_alerted') || '[]');
        try {
            const r = await fetch('/api/servers', { headers: { Authorization: 'Bearer ' + token } });
            const d = await r.json();
            const servers = d.servers || d.data || [];
            const now = Date.now();
            servers.forEach(s => {
                if (!s.expires_at || already.includes(s.id)) return;
                const diff = new Date(s.expires_at) - now;
                const days = Math.floor(diff / 86400000);
                if (days <= 7 && days >= 0) {
                    const msg = days === 0
                        ? `"${s.server_name}" expire aujourd'hui !`
                        : `"${s.server_name}" expire dans ${days} jour${days > 1 ? 's' : ''}`;
                    toast({ title: '⚠️ Expiration proche', body: msg + ' — Pensez à renouveler.' }, days <= 1 ? 'error' : 'warning', 7000);
                    already.push(s.id);
                }
            });
            sessionStorage.setItem('fh_exp_alerted', JSON.stringify(already));
        } catch(_) {}
    }

    // ─── Breadcrumb ────────────────────────────────────────────────────────────
    const BREADCRUMB_MAP = {
        '/dashboard':   [{ label:'Dashboard', href:'/dashboard' }],
        '/deploy':      [{ label:'Dashboard', href:'/dashboard' }, { label:'Déploiement' }],
        '/server':      [{ label:'Dashboard', href:'/dashboard' }, { label:'Serveur' }],
        '/profile':     [{ label:'Dashboard', href:'/dashboard' }, { label:'Mon profil' }],
        '/history':     [{ label:'Dashboard', href:'/dashboard' }, { label:'Historique' }],
        '/referral':    [{ label:'Dashboard', href:'/dashboard' }, { label:'Parrainage' }],
        '/payment':     [{ label:'Dashboard', href:'/dashboard' }, { label:'Paiement' }],
        '/shop':        [{ label:'Dashboard', href:'/dashboard' }, { label:'Boutique' }],
        '/marketplace': [{ label:'Dashboard', href:'/dashboard' }, { label:'Marketplace' }],
        '/leaderboard': [{ label:'Dashboard', href:'/dashboard' }, { label:'Classement' }],
        '/tickets':     [{ label:'Dashboard', href:'/dashboard' }, { label:'Support' }],
        '/forum':       [{ label:'Dashboard', href:'/dashboard' }, { label:'Forum' }],
        '/chat':        [{ label:'Dashboard', href:'/dashboard' }, { label:'Communauté' }],
        '/subscription':[{ label:'Dashboard', href:'/dashboard' }, { label:'Abonnement' }],
        '/status':      [{ label:'Dashboard', href:'/dashboard' }, { label:'Statut' }],
        '/pricing':     [{ label:'Accueil', href:'/' }, { label:'Tarifs' }],
        '/api':         [{ label:'Dashboard', href:'/dashboard' }, { label:'API' }],
    };

    function renderBreadcrumb(extraLabel) {
        const path = window.location.pathname.replace(/\/$/, '') || '/';
        const crumbs = BREADCRUMB_MAP[path];
        if (!crumbs) return;
        const final = extraLabel ? [...crumbs.slice(0,-1), { label: crumbs[crumbs.length-1].label }, { label: extraLabel }] : crumbs;
        const nav = document.createElement('nav');
        nav.setAttribute('aria-label','Fil d\'Ariane');
        nav.style.cssText = 'padding:10px 24px 0;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;flex-wrap:wrap;';
        nav.innerHTML = final.map((c, i) => {
            const isLast = i === final.length - 1;
            const part = isLast
                ? `<span style="color:var(--accent,#FACC15);">${_esc(c.label)}</span>`
                : `<a href="${c.href}" style="color:rgba(255,255,255,0.45);text-decoration:none;transition:.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.45)'">${_esc(c.label)}</a>`;
            const sep = !isLast ? '<i class="fas fa-chevron-right" style="color:rgba(255,255,255,0.2);font-size:9px;"></i>' : '';
            return part + sep;
        }).join('');
        // Insert after topbar or at start of body
        const main = document.querySelector('main,.page,.content,.container');
        if (main) main.insertBefore(nav, main.firstChild);
        else {
            const after = document.querySelector('.fh-topbar, .topbar, nav');
            if (after) after.insertAdjacentElement('afterend', nav);
        }
    }

    // ─── Global Ctrl+K command palette ───────────────────────────────────────
    const PALETTE_PAGES = [
        { label:'Dashboard',        icon:'fa-chart-pie',      href:'/dashboard',   keys:['dashboard','tableau'] },
        { label:'Mes serveurs',      icon:'fa-server',         href:'/dashboard',   keys:['serveur','server'] },
        { label:'Déployer',          icon:'fa-rocket',         href:'/deploy',      keys:['deploy','deployer','lancer'] },
        { label:'Chat',              icon:'fa-comments',       href:'/chat',        keys:['chat','message','communauté'] },
        { label:'Profil',            icon:'fa-user-circle',    href:'/profile',     keys:['profil','compte','avatar'] },
        { label:'Parrainage',        icon:'fa-users',          href:'/referral',    keys:['parrainage','parrain','filleul','coins'] },
        { label:'Tarifs',            icon:'fa-tags',           href:'/pricing',     keys:['tarif','prix','plan','abonnement'] },
        { label:'Boutique',          icon:'fa-shopping-cart',  href:'/shop',        keys:['boutique','shop','acheter'] },
        { label:'Paiement',          icon:'fa-credit-card',    href:'/payment',     keys:['paiement','payer','facture'] },
        { label:'Historique',        icon:'fa-history',        href:'/history',     keys:['historique','history'] },
        { label:'Statut des services',icon:'fa-heart-pulse',  href:'/status',      keys:['statut','status','services','ping'] },
        { label:'Forum',             icon:'fa-comments',       href:'/forum',       keys:['forum','aide','support'] },
        { label:'Tickets',           icon:'fa-ticket',         href:'/tickets',     keys:['ticket','support','aide'] },
        { label:'Marketplace',       icon:'fa-store',          href:'/marketplace', keys:['marketplace','marché'] },
        { label:'API Keys',          icon:'fa-key',            href:'/api-keys',    keys:['api','clé','token'] },
        { label:'Abonnement',        icon:'fa-crown',          href:'/subscription',keys:['abonnement','premium','sub'] },
        { label:'Se déconnecter',    icon:'fa-sign-out-alt',   href:null,           action:'logout', keys:['deconnexion','logout','quitter'] },
    ];

    let _paletteOpen = false;

    function openPalette() {
        if (_paletteOpen) return;
        _paletteOpen = true;
        const overlay = document.createElement('div');
        overlay.id = 'fh-palette';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,0.65);backdrop-filter:blur(6px);display:flex;align-items:flex-start;justify-content:center;padding-top:18vh;animation:palIn 0.2s ease';
        overlay.innerHTML = `
        <style>
        @keyframes palIn{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}
        .fh-pal{width:100%;max-width:560px;background:rgba(14,14,19,0.98);border:1px solid rgba(250,204,21,0.2);border-radius:18px;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,0.7);margin:0 16px}
        .fh-pal-search{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(250,204,21,0.1)}
        .fh-pal-search i{color:#52525B;font-size:16px}
        .fh-pal-search input{flex:1;background:none;border:none;outline:none;font-size:16px;color:#FAFAFA;font-family:"Plus Jakarta Sans",sans-serif;font-weight:500}
        .fh-pal-search input::placeholder{color:#52525B}
        .fh-pal-search kbd{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:5px;padding:2px 8px;font-size:11px;color:#71717A;font-family:monospace}
        .fh-pal-results{max-height:360px;overflow-y:auto;padding:6px}
        .fh-pal-item{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;cursor:pointer;transition:background 0.1s;text-decoration:none;color:#FAFAFA}
        .fh-pal-item:hover,.fh-pal-item.sel{background:rgba(250,204,21,0.1);color:#FACC15}
        .fh-pal-item:hover .fh-pi-icon,.fh-pal-item.sel .fh-pi-icon{color:#FACC15}
        .fh-pi-icon{width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;font-size:14px;color:#71717A;flex-shrink:0}
        .fh-pi-label{font-size:14px;font-weight:600}
        .fh-pal-empty{padding:32px;text-align:center;color:#52525B;font-size:13px}
        .fh-pal-hint{padding:8px 18px;border-top:1px solid rgba(255,255,255,0.04);display:flex;gap:16px;font-size:11px;color:#52525B}
        .fh-pal-hint kbd{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:1px 5px;font-family:monospace}
        </style>
        <div class="fh-pal">
            <div class="fh-pal-search">
                <i class="fas fa-search"></i>
                <input id="fh-pal-inp" placeholder="Rechercher une page, action..." autocomplete="off">
                <kbd>Esc</kbd>
            </div>
            <div class="fh-pal-results" id="fh-pal-res"></div>
            <div class="fh-pal-hint">
                <span><kbd>↑↓</kbd> Naviguer</span>
                <span><kbd>Enter</kbd> Ouvrir</span>
                <span><kbd>Esc</kbd> Fermer</span>
            </div>
        </div>`;
        document.body.appendChild(overlay);

        let selIdx = 0;
        let filtered = [];
        // Load servers dynamically for palette
        let _paletteServerEntries = [];
        const token = getToken();
        if (token) {
            fetch('/api/servers', { headers: { Authorization: 'Bearer ' + token } })
                .then(r => r.json())
                .then(d => {
                    const srvs = d.servers || d.data || [];
                    _paletteServerEntries = srvs.map(s => ({
                        label: s.server_name || s.name || ('Serveur #'+s.id),
                        icon: 'fa-server',
                        href: '/server?id=' + s.id,
                        keys: ['serveur', 'server', (s.server_name||'').toLowerCase()]
                    }));
                    renderResults(document.getElementById('fh-pal-inp')?.value || '');
                }).catch(() => {});
        }

        function renderResults(q) {
            const res = document.getElementById('fh-pal-res');
            const allItems = [...PALETTE_PAGES, ..._paletteServerEntries];
            if (!q) { filtered = [...allItems]; }
            else {
                const lq = q.toLowerCase();
                filtered = allItems.filter(p =>
                    p.label.toLowerCase().includes(lq) ||
                    (p.keys || []).some(k => k.includes(lq))
                );
            }
            selIdx = 0;
            if (!filtered.length) { res.innerHTML = '<div class="fh-pal-empty"><i class="fas fa-search" style="display:block;font-size:24px;margin-bottom:8px"></i>Aucun résultat</div>'; return; }
            res.innerHTML = filtered.map((p, i) => `
                <a class="fh-pal-item${i === 0 ? ' sel' : ''}" data-idx="${i}" href="${p.href || '#'}" data-action="${p.action || ''}">
                    <div class="fh-pi-icon"><i class="fas ${p.icon}"></i></div>
                    <span class="fh-pi-label">${_esc(p.label)}</span>
                </a>`).join('');
            res.querySelectorAll('.fh-pal-item').forEach(el => {
                el.addEventListener('click', e => {
                    const idx = parseInt(el.dataset.idx);
                    const item = filtered[idx];
                    if (item.action === 'logout') { e.preventDefault(); closePalette(); logout(); }
                    else closePalette();
                });
            });
        }

        function updateSel() {
            document.querySelectorAll('.fh-pal-item').forEach((el, i) => el.classList.toggle('sel', i === selIdx));
            const selEl = document.querySelector('.fh-pal-item.sel');
            if (selEl) selEl.scrollIntoView({ block:'nearest' });
        }

        renderResults('');
        setTimeout(() => document.getElementById('fh-pal-inp')?.focus(), 50);

        document.getElementById('fh-pal-inp').addEventListener('input', e => renderResults(e.target.value));
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') closePalette();
            else if (e.key === 'ArrowDown') { selIdx = Math.min(selIdx + 1, filtered.length - 1); updateSel(); e.preventDefault(); }
            else if (e.key === 'ArrowUp')   { selIdx = Math.max(selIdx - 1, 0); updateSel(); e.preventDefault(); }
            else if (e.key === 'Enter') {
                const item = filtered[selIdx];
                if (!item) return;
                if (item.action === 'logout') { closePalette(); logout(); }
                else if (item.href) { closePalette(); window.location.href = item.href; }
            }
        });
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) closePalette(); });
    }

    function closePalette() {
        const el = document.getElementById('fh-palette');
        if (el) el.remove();
        _paletteOpen = false;
    }

    // Ctrl+K shortcut (global)
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            _paletteOpen ? closePalette() : openPalette();
        }
    });

    // ─── Auto-run on DOMContentLoaded ────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        fillDrawer();
        if (isLoggedIn()) {
            autoRefreshIfNeeded();
            setTimeout(checkExpirationAlerts, 3000);
        }
        // Breadcrumb (auto-rendered on most pages)
        const noBreadcrumbPaths = ['/login', '/register', '/', '/index', '/pricing', '/404'];
        if (!noBreadcrumbPaths.includes(window.location.pathname)) {
            renderBreadcrumb();
        }
        // Escape closes sidebar
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

        // Track visited pages for challenges
        try {
            const pageName = window.location.pathname.replace(/^\//,'').replace(/\.html$/,'') || 'home';
            const visited = JSON.parse(localStorage.getItem('fh_visited_pages')||'[]');
            if (!visited.includes(pageName)) { visited.push(pageName); localStorage.setItem('fh_visited_pages', JSON.stringify(visited)); }
        } catch(_) {}
    });

    // ─── Expose on window ────────────────────────────────────────────────────
    Object.assign(w, {
        // Toast
        toast, showSuccess, showError, showInfo, showWarn,
        // Auth
        getToken, getUser, isLoggedIn, requireAuth, logout,
        // Sidebar
        toggleSidebar, openSidebar, closeSidebar, fillDrawer,
        // Palette
        openPalette, closePalette,
        // Breadcrumb
        renderBreadcrumb,
        // Utils
        FHUtils: { esc: _esc, checkExpirationAlerts, refreshAuthToken, autoRefreshIfNeeded }
    });

})(window);
