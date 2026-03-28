import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import deploymentsRouter from "./deployments";
import domainsRouter from "./domains";
import teamsRouter from "./teams";
import statsRouter from "./stats";
import userProfileRouter from "./user-profile";
import subscriptionsRouter from "./subscriptions";
import referralsRouter from "./referrals";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(projectsRouter);
router.use(deploymentsRouter);
router.use(domainsRouter);
router.use(teamsRouter);
router.use(statsRouter);
router.use(userProfileRouter);
router.use(subscriptionsRouter);
router.use(referralsRouter);

export default router;
