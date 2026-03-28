import { Router, type IRouter } from "express";
import { db, deploymentsTable, deploymentLogsTable, projectsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

// Simulate a deployment build process
async function simulateDeployment(deploymentId: number, projectId: number): Promise<void> {
  const buildSteps = [
    { level: "info", message: "Initializing build environment..." },
    { level: "info", message: "Installing dependencies..." },
    { level: "info", message: "Running build command..." },
    { level: "info", message: "Build completed successfully" },
    { level: "info", message: "Uploading artifacts..." },
    { level: "info", message: "Deployment ready" },
  ];

  // Set to building
  await db.update(deploymentsTable).set({ status: "building" }).where(eq(deploymentsTable.id, deploymentId));

  // Simulate build steps with delays
  setTimeout(async () => {
    try {
      for (const step of buildSteps) {
        await db.insert(deploymentLogsTable).values({
          deploymentId,
          level: step.level as "info" | "warn" | "error",
          message: step.message,
        });
        await new Promise(r => setTimeout(r, 500));
      }

      const url = `https://${Math.random().toString(36).substring(2, 10)}.flyhost.app`;
      const duration = Math.floor(Math.random() * 30000) + 10000; // 10-40 seconds

      const [deployment] = await db.update(deploymentsTable)
        .set({ status: "ready", url, duration })
        .where(eq(deploymentsTable.id, deploymentId))
        .returning();

      // Update project's latest deployment info
      await db.update(projectsTable).set({
        latestDeploymentId: deploymentId,
        latestDeploymentUrl: url,
        latestDeploymentStatus: "ready",
      }).where(eq(projectsTable.id, projectId));
    } catch (err) {
      await db.update(deploymentsTable).set({ status: "error" }).where(eq(deploymentsTable.id, deploymentId));
    }
  }, 2000);
}

router.get("/projects/:projectId/deployments", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(raw, 10);
  
  const deployments = await db.select().from(deploymentsTable)
    .where(eq(deploymentsTable.projectId, projectId))
    .orderBy(desc(deploymentsTable.createdAt));
  
  res.json(deployments);
});

router.post("/projects/:projectId/deployments", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const projectId = parseInt(raw, 10);
  const { branch, commit, commitMessage } = req.body;
  
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project || project.userId !== req.userId) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [deployment] = await db.insert(deploymentsTable).values({
    projectId,
    userId: req.userId!,
    status: "queued",
    branch: branch || project.gitBranch || "main",
    commit: commit || null,
    commitMessage: commitMessage || null,
    isProduction: false,
  }).returning();

  // Start simulation
  simulateDeployment(deployment.id, projectId);

  res.status(201).json(deployment);
});

router.get("/deployments/:deploymentId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.deploymentId) ? req.params.deploymentId[0] : req.params.deploymentId;
  const deploymentId = parseInt(raw, 10);
  
  const [deployment] = await db.select().from(deploymentsTable).where(eq(deploymentsTable.id, deploymentId)).limit(1);
  if (!deployment) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }
  
  res.json(deployment);
});

router.post("/deployments/:deploymentId/cancel", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.deploymentId) ? req.params.deploymentId[0] : req.params.deploymentId;
  const deploymentId = parseInt(raw, 10);
  
  const [deployment] = await db.update(deploymentsTable)
    .set({ status: "cancelled" })
    .where(eq(deploymentsTable.id, deploymentId))
    .returning();
  
  res.json(deployment);
});

router.post("/deployments/:deploymentId/promote", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.deploymentId) ? req.params.deploymentId[0] : req.params.deploymentId;
  const deploymentId = parseInt(raw, 10);
  
  const [deployment] = await db.update(deploymentsTable)
    .set({ isProduction: true })
    .where(eq(deploymentsTable.id, deploymentId))
    .returning();
  
  if (!deployment) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  // Update project's latest deployment info
  await db.update(projectsTable).set({
    latestDeploymentId: deploymentId,
    latestDeploymentUrl: deployment.url,
    latestDeploymentStatus: deployment.status,
  }).where(eq(projectsTable.id, deployment.projectId));
  
  res.json(deployment);
});

router.get("/deployments/:deploymentId/logs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.deploymentId) ? req.params.deploymentId[0] : req.params.deploymentId;
  const deploymentId = parseInt(raw, 10);
  
  const logs = await db.select().from(deploymentLogsTable)
    .where(eq(deploymentLogsTable.deploymentId, deploymentId))
    .orderBy(deploymentLogsTable.timestamp);
  
  res.json(logs);
});

export default router;
