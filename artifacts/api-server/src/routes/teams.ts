import { Router, type IRouter } from "express";
import { db, teamsTable, teamMembersTable, usersTable, projectsTable } from "@workspace/db";
import { eq, and, sql, isNull } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { createNotification } from "./notifications";

const router: IRouter = Router();

// ── GET /teams — list teams for current user with member counts
router.get("/teams", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const memberships = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.userId, req.userId!));

    const teamIds = memberships.map((m) => m.teamId);
    if (teamIds.length === 0) {
      res.json([]);
      return;
    }

    const teams = await db.select().from(teamsTable);
    const userTeams = teams.filter((t) => teamIds.includes(t.id));

    const withCounts = await Promise.all(
      userTeams.map(async (team) => {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(teamMembersTable)
          .where(eq(teamMembersTable.teamId, team.id));
        const myMembership = memberships.find((m) => m.teamId === team.id);
        return { ...team, memberCount: count, myRole: myMembership?.role ?? "member" };
      }),
    );

    res.json(withCounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /teams — create team
router.post("/teams", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) {
      res.status(400).json({ error: "name and slug requis" });
      return;
    }

    const cleanSlug = String(slug)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const existing = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.slug, cleanSlug))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Ce slug est déjà pris, choisissez-en un autre." });
      return;
    }

    const [team] = await db
      .insert(teamsTable)
      .values({ name: String(name).trim(), slug: cleanSlug, ownerId: req.userId! })
      .returning();

    await db.insert(teamMembersTable).values({
      teamId: team.id,
      userId: req.userId!,
      role: "owner",
    });

    res.status(201).json({ ...team, memberCount: 1, myRole: "owner" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /teams/:teamId — get single team
router.get("/teams/:teamId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (isNaN(teamId)) { res.status(400).json({ error: "teamId invalide" }); return; }

    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
    if (!team) { res.status(404).json({ error: "Équipe introuvable" }); return; }

    const isMember = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, req.userId!)))
      .limit(1);
    if (isMember.length === 0) { res.status(403).json({ error: "Accès refusé" }); return; }

    res.json(team);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /teams/:teamId — delete team (owner only)
router.delete("/teams/:teamId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (isNaN(teamId)) { res.status(400).json({ error: "teamId invalide" }); return; }

    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
    if (!team) { res.status(404).json({ error: "Équipe introuvable" }); return; }
    if (team.ownerId !== req.userId) {
      res.status(403).json({ error: "Seul le propriétaire peut supprimer l'équipe" });
      return;
    }

    await db.delete(teamMembersTable).where(eq(teamMembersTable.teamId, teamId));
    await db.delete(teamsTable).where(eq(teamsTable.id, teamId));

    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /teams/:teamId/members — list members
router.get("/teams/:teamId/members", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (isNaN(teamId)) { res.status(400).json({ error: "teamId invalide" }); return; }

    const isMember = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, req.userId!)))
      .limit(1);
    if (isMember.length === 0) { res.status(403).json({ error: "Accès refusé" }); return; }

    const members = await db
      .select({
        id: teamMembersTable.id,
        teamId: teamMembersTable.teamId,
        userId: teamMembersTable.userId,
        role: teamMembersTable.role,
        joinedAt: teamMembersTable.joinedAt,
        name: usersTable.name,
        email: usersTable.email,
        username: usersTable.username,
      })
      .from(teamMembersTable)
      .innerJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
      .where(eq(teamMembersTable.teamId, teamId));

    res.json(members);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /teams/:teamId/members — invite member by email
router.post("/teams/:teamId/members", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (isNaN(teamId)) { res.status(400).json({ error: "teamId invalide" }); return; }

    const myMembership = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, req.userId!)))
      .limit(1);
    if (myMembership.length === 0) { res.status(403).json({ error: "Accès refusé" }); return; }
    if (!["owner", "admin"].includes(myMembership[0].role)) {
      res.status(403).json({ error: "Seuls les admins et propriétaires peuvent inviter des membres" });
      return;
    }

    const { email, role = "member" } = req.body;
    if (!email) { res.status(400).json({ error: "email requis" }); return; }
    if (!["member", "admin", "viewer"].includes(role)) {
      res.status(400).json({ error: "Rôle invalide (member, admin, viewer)" });
      return;
    }

    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, String(email).toLowerCase().trim()))
      .limit(1);
    if (!targetUser) {
      res.status(404).json({ error: "Aucun compte trouvé avec cet email" });
      return;
    }
    if (targetUser.id === req.userId) {
      res.status(400).json({ error: "Vous faites déjà partie de l'équipe" });
      return;
    }

    const alreadyMember = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, targetUser.id)))
      .limit(1);
    if (alreadyMember.length > 0) {
      res.status(409).json({ error: "Cet utilisateur est déjà membre de l'équipe" });
      return;
    }

    const [member] = await db
      .insert(teamMembersTable)
      .values({ teamId, userId: targetUser.id, role })
      .returning();

    // Fetch team name for notification
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
    const inviterRow = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const inviterName = inviterRow[0]?.name ?? "Quelqu'un";

    createNotification(
      targetUser.id,
      "team_invite",
      `Invitation à l'équipe ${team?.name ?? ""}`,
      `${inviterName} vous a ajouté à l'équipe "${team?.name}" en tant que ${role}.`,
      { teamId, teamName: team?.name, role },
    ).catch(() => {});

    res.status(201).json({
      ...member,
      name: targetUser.name,
      email: targetUser.email,
      username: targetUser.username,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /teams/:teamId/members/:memberId — remove member
router.delete("/teams/:teamId/members/:memberId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const memberId = parseInt(req.params.memberId, 10);
    if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Paramètres invalides" }); return; }

    const myMembership = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, req.userId!)))
      .limit(1);
    if (myMembership.length === 0) { res.status(403).json({ error: "Accès refusé" }); return; }

    const [targetMember] = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)))
      .limit(1);
    if (!targetMember) { res.status(404).json({ error: "Membre introuvable" }); return; }
    if (targetMember.role === "owner") {
      res.status(400).json({ error: "Impossible de retirer le propriétaire" });
      return;
    }

    const canRemove =
      myMembership[0].role === "owner" ||
      myMembership[0].role === "admin" ||
      targetMember.userId === req.userId;
    if (!canRemove) { res.status(403).json({ error: "Permission insuffisante" }); return; }

    await db.delete(teamMembersTable).where(eq(teamMembersTable.id, memberId));
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /teams/:teamId/projects — list projects belonging to this team
router.get("/teams/:teamId/projects", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (isNaN(teamId)) { res.status(400).json({ error: "teamId invalide" }); return; }

    const isMember = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, req.userId!)))
      .limit(1);
    if (isMember.length === 0) { res.status(403).json({ error: "Accès refusé" }); return; }

    const projects = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.teamId, teamId), eq(projectsTable.status, "active")));

    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /teams/:teamId/projects — assign a project to this team
router.post("/teams/:teamId/projects", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (isNaN(teamId)) { res.status(400).json({ error: "teamId invalide" }); return; }

    const myMembership = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, req.userId!)))
      .limit(1);
    if (myMembership.length === 0) { res.status(403).json({ error: "Accès refusé" }); return; }

    const { projectId } = req.body;
    if (!projectId) { res.status(400).json({ error: "projectId requis" }); return; }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, parseInt(projectId, 10)), eq(projectsTable.userId, req.userId!)))
      .limit(1);
    if (!project) { res.status(404).json({ error: "Projet introuvable ou vous n'en êtes pas propriétaire" }); return; }

    const [updated] = await db
      .update(projectsTable)
      .set({ teamId })
      .where(eq(projectsTable.id, project.id))
      .returning();

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /teams/:teamId/projects/:projectId — unassign project from team
router.delete("/teams/:teamId/projects/:projectId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(teamId) || isNaN(projectId)) { res.status(400).json({ error: "Paramètres invalides" }); return; }

    const isMember = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, req.userId!)))
      .limit(1);
    if (isMember.length === 0) { res.status(403).json({ error: "Accès refusé" }); return; }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.teamId, teamId)))
      .limit(1);
    if (!project) { res.status(404).json({ error: "Projet introuvable dans cette équipe" }); return; }

    await db.update(projectsTable).set({ teamId: null }).where(eq(projectsTable.id, projectId));
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
