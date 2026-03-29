const CF_TOKEN = process.env.CF_TOKEN;
const CF_ZONE_ID = process.env.CF_ZONE_ID;
const CF_DOMAIN = "flihost.site";
const SERVER_IP = process.env.SERVER_IP;

async function cfRequest(path: string, method = "GET", body?: object) {
  if (!CF_TOKEN || !CF_ZONE_ID) {
    console.warn("[cloudflare] CF_TOKEN or CF_ZONE_ID not set, skipping");
    return null;
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as any;
  if (!data.success) {
    console.error("[cloudflare] API error:", JSON.stringify(data.errors));
    return null;
  }
  return data;
}

export async function ensureWildcardDNS(): Promise<void> {
  if (!CF_TOKEN || !CF_ZONE_ID || !SERVER_IP) {
    console.warn("[cloudflare] Skipping DNS check — missing CF_TOKEN, CF_ZONE_ID, or SERVER_IP");
    return;
  }
  try {
    // Check if wildcard record already exists
    const existing = await cfRequest(`/zones/${CF_ZONE_ID}/dns_records?name=*.${CF_DOMAIN}&type=A`);
    if (!existing) return;
    const records = existing.result || [];
    if (records.length > 0) {
      console.log("[cloudflare] Wildcard DNS already exists:", records[0].id);
      return;
    }
    // Create it
    const result = await cfRequest(`/zones/${CF_ZONE_ID}/dns_records`, "POST", {
      type: "A",
      name: `*.${CF_DOMAIN}`,
      content: SERVER_IP,
      proxied: true,
      ttl: 1,
    });
    if (result) {
      console.log("[cloudflare] ✅ Created wildcard DNS *.${CF_DOMAIN} →", SERVER_IP);
    }
  } catch (err) {
    console.error("[cloudflare] ensureWildcardDNS error:", err);
  }
}

export async function createSubdomainDNS(subdomain: string): Promise<boolean> {
  if (!CF_TOKEN || !CF_ZONE_ID || !SERVER_IP) return false;
  try {
    // proxied: false so traffic hits Wings directly on the allocated port (Wings handles HTTPS/SSL)
    const result = await cfRequest(`/zones/${CF_ZONE_ID}/dns_records`, "POST", {
      type: "A",
      name: `${subdomain}.${CF_DOMAIN}`,
      content: SERVER_IP,
      proxied: false,
      ttl: 60,
    });
    return !!result;
  } catch {
    return false;
  }
}

export async function deleteSubdomainDNS(subdomain: string): Promise<void> {
  if (!CF_TOKEN || !CF_ZONE_ID) return;
  try {
    const existing = await cfRequest(`/zones/${CF_ZONE_ID}/dns_records?name=${subdomain}.${CF_DOMAIN}&type=A`);
    if (!existing) return;
    for (const record of (existing.result || [])) {
      await cfRequest(`/zones/${CF_ZONE_ID}/dns_records/${record.id}`, "DELETE");
    }
  } catch (err) {
    console.error("[cloudflare] deleteSubdomainDNS error:", err);
  }
}
