import { Router, type IRouter } from "express";
import { db, teamsTable, teamMembersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/teams", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const memberships = await db.select().from(teamMembersTable).where(eq(teamMembersTable.userId, req.userId!));
  const teamIds = memberships.map(m => m.teamId);
  
  if (teamIds.length === 0) {
    res.json([]);
    return;
  }
  
  const teams = await db.select().from(teamsTable);
  const userTeams = teams.filter(t => teamIds.includes(t.id));
  res.json(userTeams);
});

router.post("/teams", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { name, slug } = req.body;
  if (!name || !slug) {
    res.status(400).json({ error: "name and slug are required" });
    return;
  }
  
  const [team] = await db.insert(teamsTable).values({
    name,
    slug: slug.toLowerCase().replace(/\s+/g, "-"),
    ownerId: req.userId!,
  }).returning();
  
  // Add owner as member
  await db.insert(teamMembersTable).values({ teamId: team.id, userId: req.userId!, role: "owner" });
  
  res.status(201).json(team);
});

router.get("/teams/:teamId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;
  const teamId = parseInt(raw, 10);
  
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  
  res.json(team);
});

router.get("/teams/:teamId/members", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;
  const teamId = parseInt(raw, 10);
  
  const members = await db.select({
    id: teamMembersTable.id,
    teamId: teamMembersTable.teamId,
    userId: teamMembersTable.userId,
    role: teamMembersTable.role,
    joinedAt: teamMembersTable.joinedAt,
    name: usersTable.name,
    email: usersTable.email,
    username: usersTable.username,
  }).from(teamMembersTable)
    .innerJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(eq(teamMembersTable.teamId, teamId));
  
  res.json(members);
});

router.post("/teams/:teamId/members", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;
  const teamId = parseInt(raw, 10);
  const { email, role } = req.body;
  
  if (!email || !role) {
    res.status(400).json({ error: "email and role are required" });
    return;
  }
  
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  
  const [member] = await db.insert(teamMembersTable).values({ teamId, userId: user.id, role }).returning();
  
  res.status(201).json({
    ...member,
    name: user.name,
    email: user.email,
    username: user.username,
  });
});

router.delete("/teams/:teamId/members/:memberId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const rawMemberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const memberId = parseInt(rawMemberId, 10);
  
  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, memberId));
  res.sendStatus(204);
});

export default router;
