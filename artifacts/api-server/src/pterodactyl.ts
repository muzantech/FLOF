// Pterodactyl API service — Application + Client API
const PANEL_URL = process.env.PTERODACTYL_URL!;
const APP_KEY = process.env.PTERODACTYL_APPLICATION_KEY!;
const CLIENT_KEY = process.env.PTERODACTYL_CLIENT_KEY!;
const NODE_ID = 1;
const LOCATION_ID = 1;

// EGG map: gameType -> { nestId, eggId, docker_image, startup, environment }
// Environment objects MUST include ALL variables defined by each egg (panel validates all are present)
export const EGG_CONFIGS: Record<string, {
  label: string;
  nestId: number;
  eggId: number;
  dockerImage: string;
  startup: string;
  environment: Record<string, string>;
  limits: { memory: number; swap: number; disk: number; io: number; cpu: number };
}> = {
  "vanilla-mc": {
    label: "Minecraft Vanilla",
    nestId: 1, eggId: 3,
    dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}",
    environment: {
      SERVER_JARFILE: "server.jar",
      VANILLA_VERSION: "latest",
    },
    limits: { memory: 1024, swap: 0, disk: 5120, io: 500, cpu: 100 },
  },
  "paper-mc": {
    label: "Minecraft Paper",
    nestId: 1, eggId: 5,
    dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}}",
    environment: {
      MINECRAFT_VERSION: "latest",
      SERVER_JARFILE: "server.jar",
      DL_PATH: "",
      BUILD_NUMBER: "latest",
    },
    limits: { memory: 1024, swap: 0, disk: 5120, io: 500, cpu: 100 },
  },
  "forge-mc": {
    label: "Minecraft Forge",
    nestId: 1, eggId: 1,
    dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true $( [[ ! -f unix_args.txt ]] && printf %s \"-jar {{SERVER_JARFILE}}\" || printf %s \"@unix_args.txt\" )",
    environment: {
      SERVER_JARFILE: "server.jar",
      MC_VERSION: "latest",
      BUILD_TYPE: "recommended",
      FORGE_VERSION: "",
    },
    limits: { memory: 2048, swap: 0, disk: 10240, io: 500, cpu: 150 },
  },
  "nodejs": {
    label: "Node.js",
    nestId: 5, eggId: 15,
    dockerImage: "ghcr.io/parkervcp/yolks:nodejs_24",
    startup: "if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == \"1\" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ \"${MAIN_FILE}\" == \"*.js\" ]]; then /usr/local/bin/node \"/home/container/${MAIN_FILE}\" ${NODE_ARGS}; else /usr/local/bin/ts-node --esm \"/home/container/${MAIN_FILE}\" ${NODE_ARGS}; fi",
    environment: {
      GIT_ADDRESS: "",
      BRANCH: "",
      USER_UPLOAD: "0",
      AUTO_UPDATE: "0",
      NODE_PACKAGES: "",
      USERNAME: "",
      ACCESS_TOKEN: "",
      UNNODE_PACKAGES: "",
      MAIN_FILE: "index.js",
      NODE_ARGS: "",
    },
    limits: { memory: 512, swap: 0, disk: 2048, io: 500, cpu: 100 },
  },
  "python": {
    label: "Python",
    nestId: 8, eggId: 18,
    dockerImage: "ghcr.io/parkervcp/yolks:python_3.12",
    startup: "if [[ -d .git ]] && [[ \"{{AUTO_UPDATE}}\" == \"1\" ]]; then git pull; fi; if [[ ! -z \"{{PY_PACKAGES}}\" ]]; then pip install -U --prefix .local {{PY_PACKAGES}}; fi; if [[ -f /home/container/${REQUIREMENTS_FILE} ]]; then pip install -U --prefix .local -r ${REQUIREMENTS_FILE}; fi; /usr/local/bin/python /home/container/{{PY_FILE}}",
    environment: {
      GIT_ADDRESS: "",
      BRANCH: "",
      USER_UPLOAD: "0",
      AUTO_UPDATE: "0",
      PY_FILE: "app.py",
      PY_PACKAGES: "",
      USERNAME: "",
      ACCESS_TOKEN: "",
      REQUIREMENTS_FILE: "requirements.txt",
    },
    limits: { memory: 512, swap: 0, disk: 2048, io: 500, cpu: 100 },
  },
  "php": {
    label: "PHP",
    nestId: 6, eggId: 19,
    dockerImage: "ghcr.io/parkervcp/yolks:php_8.3",
    startup: "if [ -f /home/container/composer.json ]; then composer install --no-interaction --no-dev --optimize-autoloader 2>&1 || true; fi; php -S 0.0.0.0:{{SERVER_PORT}} -t /home/container/{{DOCUMENT_ROOT}}",
    environment: {
      DOCUMENT_ROOT: ".",
      GIT_ADDRESS: "",
      USER_UPLOAD: "0",
    },
    limits: { memory: 512, swap: 0, disk: 2048, io: 500, cpu: 100 },
  },
  "java": {
    label: "Java générique",
    nestId: 7, eggId: 16,
    dockerImage: "ghcr.io/parkervcp/yolks:java_8",
    startup: "java -Dterminal.jline=false -Dterminal.ansi=true -jar {{JARFILE}}",
    environment: {
      JARFILE: "server.jar",
    },
    limits: { memory: 1024, swap: 0, disk: 5120, io: 500, cpu: 100 },
  },
  "teamspeak": {
    label: "TeamSpeak 3",
    nestId: 3, eggId: 13,
    dockerImage: "ghcr.io/pterodactyl/yolks:debian",
    startup: "./ts3server default_voice_port={{SERVER_PORT}} query_port={{QUERY_PORT}} filetransfer_ip=0.0.0.0 filetransfer_port={{FILE_TRANSFER}} query_http_port={{QUERY_HTTP}} query_ssh_port={{QUERY_SSH}} query_protocols={{QUERY_PROTOCOLS_VAR}} serveradmin_password={{SERVERADMIN_PASSWORD}} license_accepted=1",
    environment: {
      TS_VERSION: "latest",
      FILE_TRANSFER: "30033",
      QUERY_PORT: "10011",
      QUERY_PROTOCOLS_VAR: "raw,http,ssh",
      QUERY_SSH: "10022",
      QUERY_HTTP: "10080",
      SERVERADMIN_PASSWORD: "",
    },
    limits: { memory: 256, swap: 0, disk: 1024, io: 500, cpu: 50 },
  },
  "csgo": {
    label: "CS:GO",
    nestId: 2, eggId: 9,
    dockerImage: "ghcr.io/pterodactyl/games:source",
    startup: "./srcds_run -game csgo -console -port {{SERVER_PORT}} +ip 0.0.0.0 +map {{SRCDS_MAP}} -strictportbind -norestart +sv_setsteamaccount {{STEAM_ACC}}",
    environment: {
      SRCDS_MAP: "de_dust2",
      STEAM_ACC: "",
      SRCDS_APPID: "740",
    },
    limits: { memory: 1024, swap: 0, disk: 15360, io: 500, cpu: 100 },
  },
  "gmod": {
    label: "Garry's Mod",
    nestId: 2, eggId: 11,
    dockerImage: "ghcr.io/pterodactyl/games:source",
    startup: "./srcds_run -game garrysmod -console -port {{SERVER_PORT}} +ip 0.0.0.0 +host_workshop_collection {{WORKSHOP_ID}} +map {{SRCDS_MAP}} +gamemode {{GAMEMODE}} -strictportbind -norestart +sv_setsteamaccount {{STEAM_ACC}} +maxplayers {{MAX_PLAYERS}} -tickrate {{TICKRATE}} $( [ \"$LUA_REFRESH\" == \"1\" ] || printf %s '-disableluarefresh' )",
    environment: {
      SRCDS_MAP: "gm_flatgrass",
      STEAM_ACC: "",
      SRCDS_APPID: "4020",
      WORKSHOP_ID: "",
      GAMEMODE: "sandbox",
      MAX_PLAYERS: "32",
      TICKRATE: "22",
      LUA_REFRESH: "0",
    },
    limits: { memory: 1024, swap: 0, disk: 10240, io: 500, cpu: 100 },
  },
  "rust": {
    label: "Rust (jeu)",
    nestId: 4, eggId: 14,
    dockerImage: "ghcr.io/pterodactyl/games:rust",
    startup: "./RustDedicated -batchmode +server.port {{SERVER_PORT}} +server.queryport {{QUERY_PORT}} +server.identity \"rust\" +rcon.port {{RCON_PORT}} +rcon.web true +server.hostname \"{{HOSTNAME}}\" +server.level \"{{LEVEL}}\" +server.description \"{{DESCRIPTION}}\" +server.url \"{{SERVER_URL}}\" +server.headerimage \"{{SERVER_IMG}}\" +server.logoimage \"{{SERVER_LOGO}}\" +server.maxplayers {{MAX_PLAYERS}} +rcon.password \"{{RCON_PASS}}\" +server.saveinterval {{SAVEINTERVAL}} +app.port {{APP_PORT}} $( [ -z ${MAP_URL} ] && printf %s \"+server.worldsize \\\"{{WORLD_SIZE}}\\\" +server.seed \\\"{{WORLD_SEED}}\\\"\" || printf %s \"+server.levelurl {{MAP_URL}}\" ) {{ADDITIONAL_ARGS}}",
    environment: {
      HOSTNAME: "A Rust Server",
      FRAMEWORK: "vanilla",
      LEVEL: "Procedural Map",
      DESCRIPTION: "Powered by FlyHost",
      SERVER_URL: "https://flyhost.site",
      WORLD_SIZE: "3000",
      WORLD_SEED: "",
      MAX_PLAYERS: "40",
      SERVER_IMG: "",
      QUERY_PORT: "27017",
      RCON_PORT: "28016",
      RCON_PASS: "",
      SAVEINTERVAL: "60",
      ADDITIONAL_ARGS: "",
      APP_PORT: "28082",
      SERVER_LOGO: "",
      MAP_URL: "",
    },
    limits: { memory: 4096, swap: 0, disk: 15360, io: 500, cpu: 200 },
  },
};

// ——— Application API (admin actions) ———

export async function pteroAppRequest(path: string, method = "GET", body?: object) {
  const res = await fetch(`${PANEL_URL}/api/application${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${APP_KEY}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    const msg = data?.errors?.[0]?.detail || data?.message || `HTTP ${res.status}`;
    throw new Error(`Pterodactyl API error: ${msg}`);
  }
  return data;
}

// ——— Client API (user-level actions) ———

export async function pteroClientRequest(path: string, method = "GET", body?: object) {
  const res = await fetch(`${PANEL_URL}/api/client${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${CLIENT_KEY}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch {}

  if (!res.ok) {
    const msg = data?.errors?.[0]?.detail || data?.message || `HTTP ${res.status}`;
    throw new Error(`Pterodactyl Client API error: ${msg}`);
  }
  return data;
}

// ——— High-level helpers ———

export async function createPteroUser(email: string, username: string, firstName: string, lastName: string, password: string) {
  return pteroAppRequest("/users", "POST", {
    email,
    username,
    first_name: firstName,
    last_name: lastName,
    password,
    root_admin: false,
    language: "en",
  });
}

export async function getPteroUserByEmail(email: string) {
  const data = await pteroAppRequest(`/users?filter[email]=${encodeURIComponent(email)}`);
  return data.data?.[0] || null;
}

export async function getPteroUserByUsername(username: string) {
  const data = await pteroAppRequest(`/users?filter[username]=${encodeURIComponent(username)}`);
  return data.data?.[0] || null;
}

/**
 * getOrCreatePteroUser — idempotent: finds by email, then by username, then creates.
 * Handles all edge cases: previous partial creations, username collisions, etc.
 */
export async function getOrCreatePteroUser(
  email: string,
  userId: number,
  name: string,
): Promise<{ attributes: { id: number } }> {
  // 1. Look up by email (most reliable)
  const byEmail = await getPteroUserByEmail(email);
  if (byEmail) return byEmail;

  const username = `fh${userId}`;
  const nameParts = (name || "FlyHost User").split(" ");
  const firstName = nameParts[0] || "FlyHost";
  const lastName = nameParts[1] || "User";

  // 2. Look up by username (catches partial previous creations)
  const byUsername = await getPteroUserByUsername(username);
  if (byUsername) return byUsername;

  // 3. Create fresh
  return createPteroUser(email, username, firstName, lastName, `flyhost_${userId}_${Date.now()}`);
}

export async function createPteroServer(opts: {
  name: string;
  ownerId: number;
  gameType: string;
  memory?: number;
  disk?: number;
  cpu?: number;
  extraEnv?: Record<string, string>;
}) {
  const config = EGG_CONFIGS[opts.gameType];
  if (!config) throw new Error(`Type de serveur inconnu: ${opts.gameType}`);

  const memory = opts.memory || config.limits.memory;
  const disk = opts.disk || config.limits.disk;
  const cpu = opts.cpu || config.limits.cpu;

  const payload = {
    name: opts.name,
    user: opts.ownerId,
    egg: config.eggId,
    docker_image: config.dockerImage,
    startup: config.startup,
    environment: { ...config.environment, ...(opts.extraEnv || {}) },
    limits: { memory, swap: config.limits.swap, disk, io: config.limits.io, cpu },
    feature_limits: { databases: 1, backups: 2, allocations: 0 },
    allocation: { default: await getAvailableAllocation() },
    start_on_completion: false,
  };

  return pteroAppRequest("/servers", "POST", payload);
}

export async function getAvailableAllocation(): Promise<number> {
  const data = await pteroAppRequest(`/nodes/${NODE_ID}/allocations?per_page=100`);
  const free = data.data?.find((a: any) => !a.attributes.assigned);
  if (!free) throw new Error("Aucune allocation disponible sur le node");
  return free.attributes.id;
}

export async function suspendPteroServer(serverId: number) {
  return pteroAppRequest(`/servers/${serverId}/suspend`, "POST");
}

export async function unsuspendPteroServer(serverId: number) {
  return pteroAppRequest(`/servers/${serverId}/unsuspend`, "POST");
}

export async function deletePteroServer(serverId: number) {
  return pteroAppRequest(`/servers/${serverId}/force`, "DELETE");
}

export async function getPteroServerByIdentifier(identifier: string): Promise<{ id: number; name: string } | null> {
  // The Application API supports filter[uuidShort] for the 8-char identifier (e.g. "1f8fdd49")
  const data = await pteroAppRequest(`/servers?filter[uuidShort]=${identifier}&per_page=10`);
  const found = data.data?.find((s: any) => s.attributes.identifier === identifier);
  return found ? { id: found.attributes.id, name: found.attributes.name } : null;
}

export async function listPteroServers(page = 1) {
  return pteroAppRequest(`/servers?per_page=25&page=${page}&include=allocations`);
}

export async function getPteroServer(serverId: number) {
  return pteroAppRequest(`/servers/${serverId}?include=allocations`);
}

/**
 * Update server startup environment variables via the APPLICATION API (admin).
 * This bypasses read-only restrictions on the client API.
 * It GETs the current server config, merges the new env vars, then PATCHes startup.
 *
 * IMPORTANT: For eggs that use a `STARTUP` env var as the startup command (common pattern),
 * you MUST include `STARTUP` in envUpdates with the correct command, AND pass
 * startupCommand so the API startup field is also updated.
 */
export async function updateServerEnvViaAppAPI(
  serverId: number,
  envUpdates: Record<string, string>,
  startupCommand?: string
): Promise<{ applied: string[] }> {
  // GET current server config
  const serverData = await pteroAppRequest(`/servers/${serverId}`);
  const attrs = serverData.attributes;

  // Merge existing environment with our updates
  const currentEnv: Record<string, string> = attrs.container?.environment || {};
  const mergedEnv: Record<string, string> = { ...currentEnv };
  for (const [k, v] of Object.entries(envUpdates)) {
    mergedEnv[k] = v;
  }

  // Use provided startupCommand override, or fall back to current startup_command
  const startup = startupCommand ?? attrs.container?.startup_command ?? "";

  // PATCH startup config with updated env + startup command
  const patchBody = {
    startup,
    environment: mergedEnv,
    egg: attrs.egg,
    image: attrs.container?.image ?? "",
    skip_scripts: false,
  };

  const res = await fetch(`${PANEL_URL}/api/application/servers/${serverId}/startup`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${APP_KEY}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patchBody),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AppAPI startup update failed: ${res.status} ${body.substring(0, 200)}`);
  }

  const applied = Object.entries(envUpdates).map(([k, v]) => `${k} = ${JSON.stringify(v)}`);
  return { applied };
}

/** Build the correct Node.js startup command for a Pterodactyl Node egg */
export function buildNodeStartup(mainFile: string): string {
  if (mainFile.endsWith(".ts") || mainFile.endsWith(".mts")) {
    return `if [ -f /home/container/package.json ]; then /usr/local/bin/npm install --prefer-offline --no-audit --no-fund --maxsockets 2 2>&1 || true; fi; if npx --yes tsx --version &>/dev/null 2>&1; then npx tsx "/home/container/${mainFile}"; elif npx --yes ts-node --version &>/dev/null 2>&1; then npx ts-node "/home/container/${mainFile}"; else /usr/local/bin/node "/home/container/${mainFile}"; fi`;
  }
  return `if [ -f /home/container/package.json ]; then /usr/local/bin/npm install --prefer-offline --no-audit --no-fund --maxsockets 2 2>&1 || true; fi; /usr/local/bin/node "/home/container/${mainFile}"`;
}

/** Startup for Bun projects (runs inside the Node.js egg image) */
export function buildBunStartup(mainFile: string): string {
  return `if [ -f /home/container/package.json ]; then /usr/local/bin/npm install --prefer-offline --no-audit --no-fund --maxsockets 2 2>&1 || true; fi; if command -v bun &>/dev/null; then bun run "/home/container/${mainFile}"; else /usr/local/bin/node "/home/container/${mainFile}"; fi`;
}

/** Startup for Deno projects (runs inside the Node.js egg image, falls back to node) */
export function buildDenoStartup(mainFile: string): string {
  return `if command -v deno &>/dev/null; then deno run --allow-net --allow-read --allow-env "/home/container/${mainFile}"; else /usr/local/bin/node "/home/container/${mainFile}"; fi`;
}

/** Build the correct Python startup command for a Pterodactyl Python egg */
export function buildPythonStartup(pyFile: string): string {
  return `if [ -f /home/container/requirements.txt ]; then pip install -r /home/container/requirements.txt; fi; /usr/local/bin/python3 "/home/container/${pyFile}"`;
}

/** Build a PHP startup command */
export function buildPhpStartup(docRoot: string): string {
  return `if [ -f /home/container/composer.json ]; then composer install --no-interaction --no-dev --optimize-autoloader 2>&1 || true; fi; php -S 0.0.0.0:\${SERVER_PORT:-3000} -t /home/container/${docRoot}`;
}

/** Build a static file server startup (npx serve, always available in Node.js egg) */
export function buildStaticStartup(docRoot: string = "."): string {
  return `npx --yes serve /home/container/${docRoot} --listen \${SERVER_PORT:-3000} --no-clipboard 2>&1`;
}

/** Build a Ruby startup command */
export function buildRubyStartup(mainFile: string): string {
  return `if [ -f /home/container/Gemfile ]; then bundle install --without development test 2>&1 || true; fi; ruby "/home/container/${mainFile}"`;
}

/** Build a Go startup command (requires go toolchain in the image) */
export function buildGoStartup(mainFile: string): string {
  return `if command -v go &>/dev/null; then cd /home/container && go mod download 2>/dev/null || true && go run ${mainFile}; else echo "Go runtime not available in this container image"; fi`;
}

/**
 * Get the current egg ID of a server via Application API.
 * Returns null if the server cannot be found.
 */
export async function getServerCurrentEgg(identifier: string): Promise<{ eggId: number; image: string } | null> {
  try {
    const serverInfo = await getPteroServerByIdentifier(identifier);
    if (!serverInfo) return null;
    const serverData = await pteroAppRequest(`/servers/${serverInfo.id}`);
    const attrs = serverData.attributes;
    return {
      eggId: attrs.egg as number,
      image: attrs.container?.image as string || "",
    };
  } catch {
    return null;
  }
}

/**
 * Switch a server's egg to match the detected tech stack.
 * Uses PATCH /api/application/servers/{id}/startup to update egg + image + startup.
 * Then triggers a reinstall so Wings recreates the container with the new image.
 * NOTE: Files are preserved across reinstalls (volumes persist).
 */
export async function switchServerEgg(
  serverId: number,
  tech: string,
  startupCmd: string,
): Promise<{ switched: boolean; message: string }> {
  const config = EGG_CONFIGS[tech];
  if (!config) {
    return { switched: false, message: `Pas de config egg pour: ${tech}` };
  }

  try {
    // GET current server config to merge environment
    const serverData = await pteroAppRequest(`/servers/${serverId}`);
    const attrs = serverData.attributes;
    const currentEnv: Record<string, string> = attrs.container?.environment || {};

    // Build new environment from egg defaults + current values
    const newEnv: Record<string, string> = { ...config.environment, ...currentEnv };
    // Inject STARTUP so the egg uses our command
    newEnv["STARTUP"] = startupCmd;

    // PATCH startup with new egg
    const patchRes = await fetch(`${PANEL_URL}/api/application/servers/${serverId}/startup`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${APP_KEY}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startup: startupCmd,
        environment: newEnv,
        egg: config.eggId,
        image: config.dockerImage,
        skip_scripts: false,
      }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      return { switched: false, message: `Changement d'egg échoué: HTTP ${patchRes.status} — ${errText.substring(0, 150)}` };
    }

    // Trigger reinstall so Wings recreates the container with the new Docker image
    // This preserves files (volumes persist) but applies the new image
    const reinstallRes = await fetch(`${PANEL_URL}/api/application/servers/${serverId}/reinstall`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${APP_KEY}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });

    if (reinstallRes.ok || reinstallRes.status === 204) {
      return { switched: true, message: `Egg changé vers ${config.label} (${config.dockerImage}) — réinstallation en cours` };
    } else {
      // Egg was updated but reinstall might need a different endpoint or is unavailable
      // Container will use new egg on next full restart by Wings
      return { switched: true, message: `Egg mis à jour vers ${config.label} — redémarrage avec nouvelle image` };
    }
  } catch (err: any) {
    return { switched: false, message: `Erreur changement egg: ${err.message}` };
  }
}

/**
 * Polls the Application API until a server finishes installing/reinstalling.
 * Returns true if the server is ready, false on timeout or install failure.
 * Pterodactyl sets attributes.status to null when installation completes.
 */
export async function waitForServerReady(
  serverId: number,
  timeoutMs = 180_000,
  pollIntervalMs = 5_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollIntervalMs));
    try {
      const data = await pteroAppRequest(`/servers/${serverId}`);
      const status: string | null = data?.attributes?.status ?? null;
      if (status === null) return true;           // installed and ready
      if (status === "install_failed") return false; // failed — don't wait any longer
      // status === "installing" → keep polling
    } catch {
      // Transient error — keep polling
    }
  }
  return false; // Timed out
}

export async function listClientServers() {
  return pteroClientRequest("/");
}

export async function getClientServer(identifier: string) {
  return pteroClientRequest(`/servers/${identifier}`);
}

export async function sendPowerAction(identifier: string, action: "start" | "stop" | "restart" | "kill") {
  return pteroClientRequest(`/servers/${identifier}/power`, "POST", { signal: action });
}

export async function getServerResourceUsage(identifier: string) {
  return pteroClientRequest(`/servers/${identifier}/resources`);
}

export async function getServerConsoleToken(identifier: string) {
  return pteroClientRequest(`/servers/${identifier}/websocket`);
}

// ——— File Manager ———

export async function listServerFiles(identifier: string, directory = "/") {
  return pteroClientRequest(`/servers/${identifier}/files/list?directory=${encodeURIComponent(directory)}`);
}

export async function getFileContents(identifier: string, filePath: string) {
  const res = await fetch(`${PANEL_URL}/api/client/servers/${identifier}/files/contents?file=${encodeURIComponent(filePath)}`, {
    headers: {
      "Authorization": `Bearer ${CLIENT_KEY}`,
      "Accept": "text/plain",
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`File read error: ${res.status} ${t.substring(0, 100)}`);
  }
  return res.text();
}

export async function writeFileContents(identifier: string, filePath: string, content: string) {
  const res = await fetch(`${PANEL_URL}/api/client/servers/${identifier}/files/write?file=${encodeURIComponent(filePath)}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CLIENT_KEY}`,
      "Content-Type": "text/plain",
    },
    body: content,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`File write error: ${res.status} ${t.substring(0, 100)}`);
  }
  return true;
}

export async function createServerFolder(identifier: string, directory: string, name: string) {
  return pteroClientRequest(`/servers/${identifier}/files/create-folder`, "POST", { root: directory, name });
}

export async function renameServerFile(identifier: string, root: string, from: string, to: string) {
  return pteroClientRequest(`/servers/${identifier}/files/rename`, "PUT", {
    root,
    files: [{ from, to }],
  });
}

export async function deleteServerFiles(identifier: string, root: string, files: string[]) {
  return pteroClientRequest(`/servers/${identifier}/files/delete`, "POST", { root, files });
}

/**
 * Delete ALL files in the server container root (/home/container).
 * Called before a fresh deploy so old files don't pollute the new release.
 * Non-fatal: if listing or deletion fails, deploy continues anyway.
 */
export async function purgeServerFiles(identifier: string): Promise<{ deleted: number }> {
  try {
    const data = await listServerFiles(identifier, "/");
    const entries: string[] = (data?.data || [])
      .map((f: any) => f.attributes?.name as string)
      .filter(Boolean);

    if (entries.length === 0) return { deleted: 0 };

    // Delete in batches of 20 (panel API limit per request)
    const BATCH = 20;
    for (let i = 0; i < entries.length; i += BATCH) {
      const batch = entries.slice(i, i + BATCH);
      await deleteServerFiles(identifier, "/", batch);
    }
    return { deleted: entries.length };
  } catch (err: any) {
    console.warn("[purge] Could not purge server files:", err.message);
    return { deleted: 0 };
  }
}

export async function compressServerFiles(identifier: string, root: string, files: string[]) {
  return pteroClientRequest(`/servers/${identifier}/files/compress`, "POST", { root, files });
}

// ——— File upload (ZIP) to Pterodactyl server ———
export async function getUploadUrl(identifier: string): Promise<string> {
  const data = await pteroClientRequest(`/servers/${identifier}/files/upload`);
  return data.attributes.url as string;
}

/**
 * Upload a ZIP to Pterodactyl via TWO strategies:
 *   A) Panel-proxied write (POST /files/write → panel → Wings filesystem)
 *   B) Wings signed URL direct upload (fallback)
 * Then decompress and clean up.
 * Strategy A avoids direct Wings connection issues (most common failure cause).
 */
export async function uploadZipToPterodactyl(identifier: string, zipBuffer: Buffer, filename = "flyhost-deploy.zip"): Promise<void> {
  // Wings file API root "/" = server container working directory (/home/container inside Docker).
  // Files must be placed at root "/" so the server process (CWD=/home/container) can find them.
  // Using "/home/container/..." would create a nested "/home/container/home/container/..." path — wrong!
  const remotePath = `/${filename}`;

  // ── Strategy A: Panel-proxied binary write ──────────────────────
  try {
    const writeRes = await fetch(`${PANEL_URL}/api/client/servers/${identifier}/files/write?file=${encodeURIComponent(remotePath)}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLIENT_KEY}`,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(zipBuffer),
    });
    if (!writeRes.ok) {
      const t = await writeRes.text();
      throw new Error(`Proxy write ${writeRes.status}: ${t.substring(0, 150)}`);
    }
  } catch (proxyErr: any) {
    console.warn("[upload] Panel-proxy write failed, trying Wings signed URL:", proxyErr.message);

    // ── Strategy B: Wings signed URL (fallback) ───────────────────
    const uploadUrl = await getUploadUrl(identifier);
    const blob = new Blob([new Uint8Array(zipBuffer)], { type: "application/zip" });
    const form = new FormData();
    form.append("files", blob, filename);

    const uploadRes = await fetch(uploadUrl, { method: "POST", body: form });
    if (!uploadRes.ok) {
      const t = await uploadRes.text();
      throw new Error(`Wings upload ${uploadRes.status}: ${t.substring(0, 150)}`);
    }
  }

  // ── Decompress with retry ────────────────────────────────────────
  // Wait a moment to ensure the file is fully written before decompress
  await new Promise(r => setTimeout(r, 1500));

  let decompressed = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Extract at Wings root "/" so files land in the server's working directory
      await decompressServerFile(identifier, "/", filename);
      decompressed = true;
      break;
    } catch (decompErr: any) {
      if (attempt < 3) {
        console.warn(`[upload] Decompress attempt ${attempt}/3 failed:`, decompErr.message);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        throw new Error(`Décompression impossible après 3 tentatives : ${decompErr.message}`);
      }
    }
  }

  // ── Cleanup ZIP ──────────────────────────────────────────────────
  if (decompressed) {
    try {
      await deleteServerFiles(identifier, "/", [filename]);
    } catch { /* non-fatal */ }
  }
}

export async function decompressServerFile(identifier: string, root: string, file: string) {
  return pteroClientRequest(`/servers/${identifier}/files/decompress`, "POST", { root, file });
}

// ——— Server resource usage ———

export async function getServerStats(identifier: string) {
  return pteroClientRequest(`/servers/${identifier}/resources`);
}

// ——— Startup management ———
export async function getServerStartup(identifier: string) {
  return pteroClientRequest(`/servers/${identifier}/startup`);
}

export async function updateStartupVariable(identifier: string, key: string, value: string) {
  return pteroClientRequest(`/servers/${identifier}/startup/variable`, "PUT", { key, value });
}

// ——— Client API key test ———
export async function testClientKey() {
  try {
    const data = await pteroClientRequest("/");
    return { ok: true, serverCount: data.data?.length || 0 };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export { NODE_ID, LOCATION_ID };
