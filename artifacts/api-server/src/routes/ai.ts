import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

const GIFTED_BASE = "https://api.giftedtech.co.ke/api/ai";
const GIFTED_KEY = process.env.GIFTED_API_KEY || "gifted";

const FLYHOST_SYSTEM = `Tu es FlyBot, l'assistant IA de FlyHost — la plateforme d'hébergement web pour l'Afrique francophone.
FlyHost permet de déployer des applications Node.js, Python, PHP, Java et des serveurs Minecraft.
On paye en FCFA avec Orange Money, Wave ou MTN. 
Réponds toujours en français, de façon claire, courte et pratique.
Si tu ne sais pas quelque chose, dis-le honnêtement.`;

async function giftedChat(question: string, model: "gpt4o" | "gemini" | "ai" = "gpt4o"): Promise<string> {
  const fullQ = `${FLYHOST_SYSTEM}\n\nQuestion de l'utilisateur: ${question}`;
  const url = `${GIFTED_BASE}/${model}?apikey=${GIFTED_KEY}&q=${encodeURIComponent(fullQ)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`GiftedAPI HTTP ${res.status}`);
  const data = await res.json() as { status: number; result: string };
  if (!data.result) throw new Error("Réponse vide de l'IA");
  return String(data.result);
}

/**
 * POST /api/ai/chat
 * Chat general avec FlyBot
 */
router.post("/ai/chat", requireAuth, async (req, res) => {
  try {
    const { message } = req.body as { message?: string };
    if (!message?.trim()) {
      return res.status(400).json({ error: "Message requis" });
    }
    const reply = await giftedChat(message.trim());
    return res.json({ reply, model: "gpt4o" });
  } catch (err: any) {
    logger.error({ err }, "AI chat error");
    // Fallback to gemini
    try {
      const { message } = req.body as { message?: string };
      const reply = await giftedChat(message!.trim(), "gemini");
      return res.json({ reply, model: "gemini" });
    } catch {
      return res.status(500).json({ error: "L'IA est temporairement indisponible, réessaie dans un instant." });
    }
  }
});

/**
 * POST /api/ai/analyze-logs
 * Analyse des logs de déploiement/serveur
 */
router.post("/ai/analyze-logs", requireAuth, async (req, res) => {
  try {
    const { logs, serverName } = req.body as { logs?: string; serverName?: string };
    if (!logs?.trim()) {
      return res.status(400).json({ error: "Logs requis" });
    }
    const truncatedLogs = logs.slice(-3000);
    const question = `Analyse ces logs${serverName ? ` du serveur "${serverName}"` : ""} et identifie:
1. Les erreurs critiques
2. La cause probable du problème
3. Les solutions concrètes à appliquer

Logs:
\`\`\`
${truncatedLogs}
\`\`\`

Réponds de façon structurée et pratique.`;

    const reply = await giftedChat(question);
    return res.json({ reply, analyzed: true });
  } catch (err: any) {
    logger.error({ err }, "AI analyze-logs error");
    return res.status(500).json({ error: "Analyse impossible pour le moment." });
  }
});

/**
 * POST /api/ai/deploy-help
 * Aide à la configuration de déploiement
 */
router.post("/ai/deploy-help", requireAuth, async (req, res) => {
  try {
    const { framework, language, description } = req.body as {
      framework?: string;
      language?: string;
      description?: string;
    };
    const question = `Un utilisateur veut déployer une application sur FlyHost avec ces infos:
- Langage: ${language || "non précisé"}
- Framework: ${framework || "non précisé"}
- Description: ${description || "non précisé"}

Donne-lui:
1. La commande de démarrage recommandée
2. Les variables d'environnement nécessaires (si applicable)
3. Le port à utiliser
4. 2-3 conseils importants pour ce type d'app

Sois concis et pratique.`;

    const reply = await giftedChat(question);
    return res.json({ reply });
  } catch (err: any) {
    logger.error({ err }, "AI deploy-help error");
    return res.status(500).json({ error: "Aide indisponible pour le moment." });
  }
});

export default router;
