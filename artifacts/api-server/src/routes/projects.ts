import { Router, type IRouter } from "express";
import { db, projectsTable, deploymentsTable, envVarsTable, domainsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/projects", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const teamId = req.query.teamId ? parseInt(req.query.teamId as string, 10) : null;
  
  let projects;
  if (teamId) {
    projects = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.teamId, teamId), eq(projectsTable.status, "active")))
      .orderBy(desc(projectsTable.updatedAt));
  } else {
    projects = await db.select().from(projectsTable)
      .where(and(eq(projectsTable.userId, req.userId!), eq(projectsTable.status, "active")))
      .orderBy(desc(projectsTable.updatedAt));
  }
  
  res.json(projects);
});

router.post("/projects", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { name, description, framework, gitRepo, gitBranch, teamId } = req.body;
  if (!name) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now().toString(36);
  
  const [project] = await db.insert(projectsTable).values({
    name,
    slug,
    description: description || null,
    framework: framework || null,
    gitRepo: gitRepo || null,
    gitBranch: gitBranch || "main",
    teamId: teamId || null,
    userId: req.userId!,
    status: "active",
  }).returning();

  res.status(201).json(project);
});

router.get("/projects/:projectId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(raw, 10);
  
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.userId !== req.userId) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  
  res.json(project);
});

router.patch("/projects/:projectId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(raw, 10);
  
  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!existing || existing.userId !== req.userId) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  
  const { name, description, framework, gitRepo, gitBranch, teamId } = req.body;
  const [project] = await db.update(projectsTable).set({
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(framework !== undefined && { framework }),
    ...(gitRepo !== undefined && { gitRepo }),
    ...(gitBranch !== undefined && { gitBranch }),
    ...(teamId !== undefined && { teamId: teamId === null ? null : parseInt(teamId, 10) }),
  }).where(eq(projectsTable.id, projectId)).returning();
  
  res.json(project);
});

router.delete("/projects/:projectId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(raw, 10);
  
  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!existing || existing.userId !== req.userId) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  
  await db.update(projectsTable).set({ status: "deleted" }).where(eq(projectsTable.id, projectId));
  res.sendStatus(204);
});

// ENV VARS
router.get("/projects/:projectId/env", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(raw, 10);
  
  const vars = await db.select().from(envVarsTable).where(eq(envVarsTable.projectId, projectId)).orderBy(envVarsTable.key);
  res.json(vars);
});

router.post("/projects/:projectId/env", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(raw, 10);
  const { key, value, environment } = req.body;
  
  if (!key || !value || !environment) {
    res.status(400).json({ error: "key, value, and environment are required" });
    return;
  }
  
  const [envVar] = await db.insert(envVarsTable).values({ projectId, key, value, environment }).returning();
  res.status(201).json(envVar);
});

router.delete("/projects/:projectId/env/:envId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const rawEnvId = Array.isArray(req.params.envId) ? req.params.envId[0] : req.params.envId;
  const envId = parseInt(rawEnvId, 10);
  
  await db.delete(envVarsTable).where(eq(envVarsTable.id, envId));
  res.sendStatus(204);
});

// DOMAINS
router.get("/projects/:projectId/domains", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(raw, 10);
  
  const domains = await db.select().from(domainsTable).where(eq(domainsTable.projectId, projectId));
  res.json(domains);
});

router.post("/projects/:projectId/domains", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(raw, 10);
  const { name } = req.body;
  
  if (!name) {
    res.status(400).json({ error: "Domain name is required" });
    return;
  }
  
  const existing = await db.select().from(domainsTable).where(eq(domainsTable.name, name)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Domain already in use" });
    return;
  }
  
  const [domain] = await db.insert(domainsTable).values({ projectId, name, verified: false, primary: false }).returning();
  res.status(201).json(domain);
});

export default router;
