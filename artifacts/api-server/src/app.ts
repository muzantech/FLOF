import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve built React frontend as static files (for VPS proxy fallback)
const FRONTEND_DIST = path.resolve(__dirname, "../../flyhost/dist/public");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, {
    maxAge: "1y",
    immutable: true,
    index: false,
  }));
  // SPA fallback — any non-API, non-asset route returns index.html
  app.get("/{*splat}", (_req: Request, res: Response) => {
    const indexPath = path.join(FRONTEND_DIST, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: "Frontend not built" });
    }
  });
}

export default app;
