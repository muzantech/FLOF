import { Router, type IRouter } from "express";
import { db, projectsTable, deploymentsTable, domainsTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/stats", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  const [projectsCount] = await db.select({ count: count() }).from(projectsTable)
    .where(and(eq(projectsTable.userId, userId), eq(projectsTable.status, "active")));

  const userProjects = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.userId, userId), eq(projectsTable.status, "active")));

  const projectIds = userProjects.map(p => p.id);

  let totalDeployments = 0;
  let activeDeployments = 0;
  let successRate = 0;
  let totalDomains = 0;

  if (projectIds.length > 0) {
    const deployments = await db.select().from(deploymentsTable)
      .where(sql`${deploymentsTable.projectId} = ANY(${sql.raw(`ARRAY[${projectIds.join(",")}]`)})`);

    totalDeployments = deployments.length;
    activeDeployments = deployments.filter(d => d.status === "building" || d.status === "queued").length;
    const readyDeployments = deployments.filter(d => d.status === "ready").length;
    successRate = totalDeployments > 0 ? Math.round((readyDeployments / totalDeployments) * 100) : 0;

    const domains = await db.select().from(domainsTable)
      .where(sql`${domainsTable.projectId} = ANY(${sql.raw(`ARRAY[${projectIds.join(",")}]`)})`);
    totalDomains = domains.length;
  }

  res.json({
    totalProjects: projectsCount.count,
    totalDeployments,
    activeDeployments,
    successRate,
    totalDomains,
  });
});

export default router;
