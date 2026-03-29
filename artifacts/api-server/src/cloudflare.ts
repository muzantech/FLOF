/**
 * cloudflare.ts
 *
 * Architecture:
 *   - ONE wildcard DNS record: *.flihost.site → SERVER_IP (proxied / orange cloud)
 *   - Individual subdomain records are NOT needed — the wildcard covers all of them
 *   - Cloudflare proxies all *.flihost.site traffic to port 80 on the server
 *   - Express subdomain proxy reads the Host header and routes to the correct internal port
 *
 * This keeps Cloudflare clean (no hundreds of individual records) and DNS is instant.
 */
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
    const existing = await cfRequest(`/zones/${CF_ZONE_ID}/dns_records?name=*.${CF_DOMAIN}&type=A`);
    if (!existing) return;
    const records: any[] = existing.result || [];
    if (records.length > 0) {
      // Update if IP changed
      const record = records[0];
      if (record.content !== SERVER_IP || !record.proxied) {
        await cfRequest(`/zones/${CF_ZONE_ID}/dns_records/${record.id}`, "PUT", {
          type: "A",
          name: `*.${CF_DOMAIN}`,
          content: SERVER_IP,
          proxied: true,
          ttl: 1,
        });
        console.log("[cloudflare] ✅ Updated wildcard DNS *.flihost.site →", SERVER_IP);
      } else {
        console.log("[cloudflare] Wildcard DNS already correct:", record.id);
      }
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
      console.log(`[cloudflare] ✅ Created wildcard DNS *.${CF_DOMAIN} →`, SERVER_IP);
    }
  } catch (err) {
    console.error("[cloudflare] ensureWildcardDNS error:", err);
  }
}

/**
 * createSubdomainDNS — No longer creates individual records.
 * The wildcard *.flihost.site (proxied) covers all subdomains automatically.
 * We just ensure the wildcard exists. Returns true on success.
 */
export async function createSubdomainDNS(subdomain: string): Promise<boolean> {
  await ensureWildcardDNS();
  console.log(`[cloudflare] Subdomain "${subdomain}.${CF_DOMAIN}" covered by wildcard DNS`);
  return true;
}

/**
 * deleteSubdomainDNS — Kept for cleanup of any legacy individual records.
 * With the wildcard approach, individual records may not exist.
 */
export async function deleteSubdomainDNS(subdomain: string): Promise<void> {
  if (!CF_TOKEN || !CF_ZONE_ID) return;
  try {
    const existing = await cfRequest(`/zones/${CF_ZONE_ID}/dns_records?name=${subdomain}.${CF_DOMAIN}&type=A`);
    if (!existing) return;
    const records: any[] = existing.result || [];
    for (const record of records) {
      await cfRequest(`/zones/${CF_ZONE_ID}/dns_records/${record.id}`, "DELETE");
      console.log(`[cloudflare] Deleted individual DNS record for ${subdomain}.${CF_DOMAIN}`);
    }
  } catch (err) {
    console.error("[cloudflare] deleteSubdomainDNS error:", err);
  }
}
