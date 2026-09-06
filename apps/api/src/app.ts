import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import RedisStore from "connect-redis";

import { setupAuth } from "./auth";
import { setupBullBoard } from "./config/bullboard";
import { getRedisClient } from "./config/redis";
import routes from "./routes";
import { CONSTANTS } from "@reachinbox/shared";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Session with Redis store
const store = new RedisStore({ client: getRedisClient() as any, prefix: "reachinbox:sess:" });
app.use(session({
  store,
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: CONSTANTS.SESSION_TTL_SECONDS * 1000,
    sameSite: "lax",
  },
}));

setupAuth(app);
setupBullBoard(app);

app.use("/api", routes);

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;
