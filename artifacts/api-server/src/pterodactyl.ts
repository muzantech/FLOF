// Pterodactyl API service — Application + Client API
const PANEL_URL = process.env.PTERODACTYL_URL!;
const APP_KEY = process.env.PTERODACTYL_APPLICATION_KEY!;
const CLIENT_KEY = process.env.PTERODACTYL_CLIENT_KEY!;
const NODE_ID = 1;
const LOCATION_ID = 1;

// EGG map: gameType -> { nestId, eggId, docker_image, startup, environment }
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
    environment: { SERVER_JARFILE: "server.jar", VANILLA_VERSION: "latest" },
    limits: { memory: 1024, swap: 0, disk: 5120, io: 500, cpu: 100 },
  },
  "paper-mc": {
    label: "Minecraft Paper",
    nestId: 1, eggId: 5,
    dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}}",
    environment: { SERVER_JARFILE: "server.jar", BUILD_NUMBER: "latest" },
    limits: { memory: 1024, swap: 0, disk: 5120, io: 500, cpu: 100 },
  },
  "forge-mc": {
    label: "Minecraft Forge",
    nestId: 1, eggId: 1,
    dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    startup: "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}",
    environment: { SERVER_JARFILE: "server.jar", MINECRAFT_VERSION: "1.20.1", FORGE_VERSION: "latest" },
    limits: { memory: 2048, swap: 0, disk: 10240, io: 500, cpu: 150 },
  },
  "nodejs": {
    label: "Node.js",
    nestId: 5, eggId: 15,
    dockerImage: "ghcr.io/parkervcp/yolks:nodejs_24",
    startup: "if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; /usr/local/bin/node /home/container/{{MAIN_FILE}}",
    environment: { MAIN_FILE: "index.js", NODE_PACKAGES: "", UNNODE_PACKAGES: "", AUTO_UPDATE: "0", NODE_ARGS: "" },
    limits: { memory: 512, swap: 0, disk: 2048, io: 500, cpu: 100 },
  },
  "python": {
    label: "Python",
    nestId: 8, eggId: 18,
    dockerImage: "ghcr.io/parkervcp/yolks:python_3.12",
    startup: "python {{MAIN_FILE}}",
    environment: { MAIN_FILE: "main.py", PY_PACKAGES: "" },
    limits: { memory: 512, swap: 0, disk: 2048, io: 500, cpu: 100 },
  },
  "rust": {
    label: "Rust (game)",
    nestId: 4, eggId: 14,
    dockerImage: "ghcr.io/parkervcp/steamcmd:rust",
    startup: "./RustDedicated -batchmode +server.port {{SERVER_PORT}} +server.hostname \"{{HOSTNAME}}\" +server.identity \"{{SERVER_IDENTITY}}\" +rcon.web {{RCON_WEB}} +rcon.password \"{{RCON_PASS}}\" +rcon.port {{RCON_PORT}}",
    environment: { HOSTNAME: "Rust Server", SERVER_IDENTITY: "MyRustServer", RCON_PASS: "password", RCON_WEB: "1", RCON_PORT: "28016" },
    limits: { memory: 4096, swap: 0, disk: 15360, io: 500, cpu: 200 },
  },
  "csgo": {
    label: "CS:GO",
    nestId: 2, eggId: 9,
    dockerImage: "ghcr.io/parkervcp/steamcmd:source",
    startup: "./srcds_run -game csgo +ip 0.0.0.0 -port {{SERVER_PORT}} +map {{SRCDS_MAP}}",
    environment: { SRCDS_MAP: "de_dust2", STEAM_ACC: "", SRCDS_GAME: "csgo" },
    limits: { memory: 1024, swap: 0, disk: 15360, io: 500, cpu: 100 },
  },
  "gmod": {
    label: "Garry's Mod",
    nestId: 2, eggId: 11,
    dockerImage: "ghcr.io/parkervcp/steamcmd:source",
    startup: "./srcds_run -game garrysmod -port {{SERVER_PORT}} +map {{SRCDS_MAP}} +gamemode {{SRCDS_GAMEMODE}}",
    environment: { SRCDS_MAP: "gm_flatgrass", SRCDS_GAMEMODE: "sandbox" },
    limits: { memory: 1024, swap: 0, disk: 10240, io: 500, cpu: 100 },
  },
  "teamspeak": {
    label: "TeamSpeak 3",
    nestId: 3, eggId: 13,
    dockerImage: "ghcr.io/parkervcp/yolks:debian",
    startup: "./ts3server_minimal_runscript.sh",
    environment: { TS_TOKEN: "" },
    limits: { memory: 256, swap: 0, disk: 1024, io: 500, cpu: 50 },
  },
  "java": {
    label: "Java générique",
    nestId: 7, eggId: 16,
    dockerImage: "ghcr.io/pterodactyl/yolks:java_21",
    startup: "java -jar {{SERVER_JARFILE}}",
    environment: { SERVER_JARFILE: "server.jar" },
    limits: { memory: 1024, swap: 0, disk: 5120, io: 500, cpu: 100 },
  },
  "php": {
    label: "PHP",
    nestId: 6, eggId: 19,
    dockerImage: "ghcr.io/parkervcp/yolks:php_8.3",
    startup: "php {{MAIN_FILE}}",
    environment: { MAIN_FILE: "index.php" },
    limits: { memory: 512, swap: 0, disk: 2048, io: 500, cpu: 100 },
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
    language: "fr",
  });
}

export async function getPteroUserByEmail(email: string) {
  const data = await pteroAppRequest(`/users?filter[email]=${encodeURIComponent(email)}`);
  return data.data?.[0] || null;
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

export async function getPteroServerByIdentifier(identifier: string): Promise<{ id: number } | null> {
  const data = await pteroAppRequest(`/servers?filter[identifier]=${identifier}&per_page=10`);
  const found = data.data?.find((s: any) => s.attributes.identifier === identifier);
  return found ? { id: found.attributes.id } : null;
}

export async function listPteroServers(page = 1) {
  return pteroAppRequest(`/servers?per_page=25&page=${page}`);
}

export async function getPteroServer(serverId: number) {
  return pteroAppRequest(`/servers/${serverId}`);
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

export async function compressServerFiles(identifier: string, root: string, files: string[]) {
  return pteroClientRequest(`/servers/${identifier}/files/compress`, "POST", { root, files });
}

// ——— File upload (ZIP) to Pterodactyl server ———
export async function getUploadUrl(identifier: string): Promise<string> {
  const data = await pteroClientRequest(`/servers/${identifier}/files/upload`);
  return data.attributes.url as string;
}

export async function uploadZipToPterodactyl(identifier: string, zipBuffer: Buffer, filename = "flyhost-deploy.zip"): Promise<void> {
  // 1. Get signed upload URL
  const uploadUrl = await getUploadUrl(identifier);

  // 2. Upload the ZIP using FormData (native Node.js 18+)
  const blob = new Blob([zipBuffer], { type: "application/zip" });
  const formData = new FormData();
  formData.append("files", blob, filename);

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok) {
    const t = await uploadRes.text();
    throw new Error(`ZIP upload failed: ${uploadRes.status} ${t.substring(0, 200)}`);
  }

  // 3. Decompress the uploaded ZIP in /home/container/
  await decompressServerFile(identifier, "/home/container", filename);

  // 4. Clean up the ZIP file from the server
  try {
    await deleteServerFiles(identifier, "/home/container", [filename]);
  } catch {
    // Non-fatal — zip cleanup failure shouldn't fail the deploy
  }
}

export async function decompressServerFile(identifier: string, root: string, file: string) {
  return pteroClientRequest(`/servers/${identifier}/files/decompress`, "POST", { root, file });
}

// ——— Server resource usage ———

export async function getServerStats(identifier: string) {
  return pteroClientRequest(`/servers/${identifier}/resources`);
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
